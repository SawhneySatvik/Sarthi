/**
 * core/plan/rollover.ts — D-053 daily plan rollover (UIE-0a, HIGHEST RISK).
 *
 * Before UIE-0a there was NO rollover: plan items were materialized only at onboarding
 * accept (Day-1), capture auto-check, and seed — so steady-state Today emptied once the
 * stamped day passed. `ensurePlanRolledOver` is the on-open staleness materializer: run
 * from the Today server read path (mirroring the coach-brief "derive on read, no cron"
 * pattern — there is no job infra and the core must stay keyless), it advances each
 * active arc to the current local day.
 *
 * Framework-import-clean (invariant #9): imports ONLY `@/core/time` + repo contract
 * types (no Next/React, no DB driver — invariant #5 holds via the injected repos). The
 * whole loop is keyless: pure repository logic, no LLM/network/key (invariant #3).
 *
 * What it does per active arc, inside ONE `repos.transaction` (algorithm §1.3, D-053):
 *   - Idempotency guard: an arc that already has a row at `today` is a no-op (re-checked
 *     inside the txn, so a double-render / concurrent tab lost-race just re-reads + exits).
 *   - Arc end: an arc past its `endDate` flips to `status:'complete'` and materializes
 *     NOTHING (the arc-complete celebration Today render is UIE-0e — 0a leaves the render
 *     to the existing view layer, which falls through to the harmless `nothing-planned`).
 *   - Materialize today: clone the arc's most-recent materialized day (`max(localDate) <
 *     today`) — task/target/checkin as fresh `status:'pending'` (`completionSource:null`,
 *     `dueAt:null`, all other business fields VERBATIM incl. integer targets); a milestone
 *     carries forward ONLY if incomplete (a `done` milestone never repeats).
 *   - Carry-forward: prior-day rows still `pending`/`active` → `status:'missed'` (existing
 *     enum — honest per-day history; the incomplete work re-appears as today's fresh row).
 *   - Advance the arc's `dayNumber` to today's day-of-arc (bounded by a fixed arc length).
 *   - Gap hop: after N absent days it materializes ONLY today (one hop, no per-day backfill).
 *
 * What it NEVER touches: XP, `domain_progress`, streaks, coach notes, the commit envelope,
 * and no estimated value of any kind — it only re-schedules rows the user explicitly
 * accepted at onboarding, so invariant #1 (nothing estimated writes unconfirmed) holds by
 * construction. It is the same write class as the plain `setItemStatus` plan mutation, not
 * a capture commit — plan scheduling rows are outside the D-038 commit audit group, so
 * rollover cannot corrupt a capture undo.
 */
import type { UserScopedRepositories } from "@/core/contracts";
import { daysBetweenLocal, localDateInZone } from "@/core/time";
import type { PlanItemCreate, PlanItemRecord, PlanArcRecord } from "@/data/schema/contract";

export interface EnsurePlanRolledOverOptions {
  /** The profile's IANA zone (already validated + defaulted by the caller). */
  timezone: string;
  /** The single UTC instant the caller derived `localDate` from — threaded so the
   *  materialized day and the read's day-key can never straddle midnight. */
  nowIso: string;
}

/** Statuses that are still "open work" and thus carry forward as a fresh pending clone. */
const CARRY_FORWARD_STATUS = new Set<PlanItemRecord["status"]>(["pending", "active"]);

/** The typed create input for a materialized row (tenant `userId` is injected by the repo). */
type PlanItemCreateInput = Omit<PlanItemCreate, "userId">;

/** The one thing to do to an arc for `today`, or `null` when the arc needs no work. */
type ArcRoll =
  | { kind: "complete" }
  | { kind: "materialize"; missedIds: readonly string[]; clones: readonly PlanItemCreateInput[]; dayNumber: number };

/** The bounded arc length (inclusive) for a fixed-end arc, else null for open-ended. */
function boundedArcLength(arc: PlanArcRecord): number | null {
  if (arc.endDate === null) return null;
  return daysBetweenLocal(arc.startDate, arc.endDate) + 1;
}

/** Clone one template row forward to `today`: business fields VERBATIM (integer targets
 *  copied as-is), per-day scheduling fields reset to a fresh pending state. */
function cloneToToday(item: PlanItemRecord, today: string): PlanItemCreateInput {
  return {
    arcId: item.arcId,
    domain: item.domain,
    kind: item.kind,
    title: item.title,
    dueAt: null,
    localDate: today,
    targetValue: item.targetValue,
    targetUnit: item.targetUnit,
    status: "pending",
    completionSource: null,
    ruleJson: item.ruleJson,
    linkedHabitId: item.linkedHabitId,
    linkedSkillId: item.linkedSkillId,
  };
}

/**
 * The SINGLE pure decision for one arc — the cheap outside-txn pre-check AND the in-txn
 * apply loop both call this, so they can never drift (the pre-check must not no-op when
 * the loop would act, or vice-versa). `arcItems` are just this arc's rows.
 *
 * Returns `null` (no work) when the arc is inactive, already has a `today` row, has no
 * prior day to template from, OR the roll would neither clone any row nor settle any open
 * row (the all-terminal resting state — e.g. a template of only `done` milestones). That
 * last guard is what stops an open-ended arc with nothing left to schedule from re-opening
 * a write transaction on every render. (Currently unreachable: no code path creates a
 * `milestone`-kind plan_item, so every template has ≥1 task/target/checkin that clones —
 * but the milestone rule below makes zero-clone representable, so the guard closes it.)
 */
function computeArcRoll(arc: PlanArcRecord, arcItems: readonly PlanItemRecord[], today: string): ArcRoll | null {
  if (arc.status !== "active") return null;
  // Idempotency guard: already materialized today → nothing to do.
  if (arcItems.some((item) => item.localDate === today)) return null;
  // Arc past its bounded end → the one-time `complete` flip, materialize nothing (§1.3.3).
  if (arc.endDate !== null && today > arc.endDate) return { kind: "complete" };

  // Template = the arc's most recent materialized day strictly before today (§1.3.4).
  const priorDates = arcItems.map((item) => item.localDate).filter((localDate) => localDate < today);
  if (priorDates.length === 0) return null; // no prior day to clone from → nothing to do
  const templateDate = priorDates.reduce((max, date) => (date > max ? date : max), priorDates[0]);

  // Carry-forward bookkeeping (§1.3.5): every prior-day open row → `missed`.
  const missedIds = arcItems
    .filter((item) => item.localDate < today && CARRY_FORWARD_STATUS.has(item.status))
    .map((item) => item.id);

  // Clone the template forward — a `done` milestone never repeats; an incomplete
  // (pending/active/skipped/missed) milestone and every task/target/checkin do.
  const clones = arcItems
    .filter((item) => item.localDate === templateDate)
    .filter((item) => !(item.kind === "milestone" && item.status === "done"))
    .map((item) => cloneToToday(item, today));

  // Nothing to schedule AND nothing to settle → the arc rests (no perpetual re-roll).
  if (clones.length === 0 && missedIds.length === 0) return null;

  const length = boundedArcLength(arc);
  const rawDayNumber = daysBetweenLocal(arc.startDate, today) + 1;
  return {
    kind: "materialize",
    missedIds,
    clones,
    dayNumber: length !== null ? Math.min(rawDayNumber, length) : rawDayNumber,
  };
}

export async function ensurePlanRolledOver(
  repos: UserScopedRepositories,
  options: EnsurePlanRolledOverOptions,
): Promise<void> {
  const today = localDateInZone(options.nowIso, options.timezone);

  // Cheap on-open pre-check (pure reads, no transaction): if no active arc is stale, the
  // common case (already rolled today) opens no write transaction at all — this shrinks
  // the §1.6 "mutation during an RSC GET render" surface to only the days a roll is due.
  const arcs = await repos.plans.arcs.list({});
  if (!arcs.some((arc) => arc.status === "active")) return;
  const allItems = await repos.plans.items.list({});
  const stale = arcs.some(
    (arc) => computeArcRoll(arc, allItems.filter((item) => item.arcId === arc.id), today) !== null,
  );
  if (!stale) return;

  await repos.transaction(async () => {
    // Re-read INSIDE the txn — the authoritative staleness re-check. A concurrent render
    // that committed a roll first is now visible here, so the per-arc plan is `null`.
    const txArcs = await repos.plans.arcs.list({});
    const txItems = await repos.plans.items.list({});

    for (const arc of txArcs) {
      const roll = computeArcRoll(arc, txItems.filter((item) => item.arcId === arc.id), today);
      if (roll === null) continue;

      if (roll.kind === "complete") {
        // Once complete the status guard skips this arc forever, so this never re-fires.
        await repos.plans.arcs.update(arc.id, { status: "complete" });
        continue;
      }

      // Settle prior open rows as `missed` (honest history), then materialize today's fresh
      // pending clones, then advance the day counter. `buildTodayView` renders `dayNumber`
      // directly and partitions on the given `localDate` — no view change needed.
      for (const id of roll.missedIds) {
        await repos.plans.items.update(id, { status: "missed" });
      }
      for (const clone of roll.clones) {
        await repos.plans.items.create(clone);
      }
      await repos.plans.arcs.update(arc.id, { dayNumber: roll.dayNumber });
    }
  });
}
