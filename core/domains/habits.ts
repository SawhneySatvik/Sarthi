/**
 * core/domains/habits.ts — SAR-009 (D-B/D-C/D-D/D-E/D-H). The pure, framework-clean
 * Habits lens read-model: the day's habits + their `habit_logs` history → a checklist
 * of grace-aware streak rows, a headline, and a month heatmap. Plus two small helpers
 * the server action leans on: `resolveRuleDayTotals` (live source aggregates for the
 * satisfied-by badge — repos-INJECTED, never imported) and `planManualTick` (the pure
 * toggle decision for the one manual-tick write path).
 *
 * Deterministic, INTEGER end-to-end (fractions only at the display edge, like
 * `HealthRing.fraction`). No framework/DB import (invariant #9): the repo edge is a
 * type-only `@/core/contracts` param, exactly like `core/capture/commit.ts`. Streaks
 * REUSE the game kernel (`computeStreak` + the single `GRACE_DAYS`), never re-derived.
 */
import type { UserScopedRepositories } from "@/core/contracts";
import { computeStreak, daysBetween, GRACE_DAYS, toDayNumber } from "@/core/game";
import type {
  HabitLogRecord,
  HabitRecord,
  HabitSatisfactionRuleRecord,
} from "@/data/schema/contract";

/** Statuses that count a habit-day as active — for both the per-habit flame and the
 *  heatmap-fraction/grace neighbours (headline "done" stays strict `done`, D-B). */
const STREAK_ACTIVE = new Set<HabitLogRecord["status"]>(["done", "partial"]);

export interface HabitSatisfiedBy {
  /** D-E rule text, e.g. "Satisfies itself from Health — water ≥ 2,000 ml". */
  hint: string;
  sourceDomain: string;
  /** Live integer aggregate for the rule's source-kind today (null = unavailable). */
  todayTotal: number | null;
  /** From the HABIT — drives the "900 / 3,000 ml" live-metric display at the UI edge. */
  targetValue: number | null;
  targetUnit: string | null;
}

export interface HabitRow {
  habitId: string;
  name: string;
  /** Grace-aware per-habit streak (D-C — the reused `computeStreak` kernel). */
  streak: number;
  today: "done" | "partial" | "skipped" | "missed" | "unlogged";
  /** Today's log.source bucket; "capture"/"tap"/seed all fold to "manual". Null = no log. */
  source: "manual" | "satisfied-by" | null;
  /** Non-null iff the habit has ≥1 satisfaction rule ⇒ rule-bearing ⇒ refuses manual ticks. */
  satisfiedBy: HabitSatisfiedBy | null;
}

export interface HeatmapDay {
  localDate: string;
  dayOfMonth: number;
  /** Habits done that day (strict `done`). Additive to the pinned type so the per-day
   *  aria-label can read "N of M done" — mirrors HealthRing carrying value+target+fraction. */
  doneCount: number;
  total: number;
  /** doneCount/total, clamped [0,1] (display-only, like `HealthRing.fraction`). */
  fraction: number;
  /** Hollow-ring day: a bridged miss the grace window tolerates (D-D). */
  grace: boolean;
}

export interface HabitsView {
  localDate: string;
  /** "6 of 8 today" — done = today status `done`; total = non-archived habits. */
  headline: { done: number; total: number };
  /** Checklist in seed order (createdAt, then id). */
  rows: HabitRow[];
  /** Current month of `localDate`, Monday-start weeks, null = pad cell. */
  heatmap: { weeks: (HeatmapDay | null)[][] };
}

export interface HabitsInput {
  localDate: string;
  habits: readonly HabitRecord[];
  logs: readonly HabitLogRecord[];
  rules: readonly HabitSatisfactionRuleRecord[];
  /** Live per-rule source aggregates for `localDate`, keyed by rule id (from
   *  `resolveRuleDayTotals`). Null value = source rows unavailable. */
  ruleTotals: ReadonlyMap<string, number | null>;
}

const DOMAIN_LABEL: Record<string, string> = {
  overall: "Overall",
  health: "Health",
  money: "Money",
  habits: "Habits",
  skills: "Skills",
};

/** Rule source-kind → the everyday noun in the hint (falls back to the aggregate field). */
const NOUN_BY_KIND: Record<string, string> = {
  skillSession: "practice",
  workout: "exercise",
  water: "water",
  meal: "food",
  transaction: "spend",
  weighIn: "weight",
  habitLog: "habit",
};

/** Integer-safe: non-numeric/non-finite contributes 0 (mirrors `commit.ts` `toInt`). */
function toInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Plain thousands grouping for a non-money display integer (e.g. 2000 → "2,000"). */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function compareRecords(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string },
): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The satisfied-by rule explanation, composed from the rule's own columns — the
 * glass-box "why this ticks itself" (D-E). Live progress is shown separately by the
 * lens badge (`todayTotal`/`targetValue`); this string is the rule, not the state.
 */
export function ruleHint(rule: HabitSatisfactionRuleRecord): string {
  const label = DOMAIN_LABEL[rule.sourceDomain] ?? rule.sourceDomain;
  const noun = NOUN_BY_KIND[rule.sourceKind] ?? rule.aggregateField;
  const unit = rule.unit ? ` ${rule.unit}` : "";
  return `Satisfies itself from ${label} — ${noun} ≥ ${groupThousands(rule.minimumValue)}${unit}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Monday-start weekday index (0 = Mon … 6 = Sun) for an ISO local date. */
function mondayIndex(localDate: string): number {
  const [year, month, day] = localDate.split("-").map((p) => Number.parseInt(p, 10));
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sun
  return (dow + 6) % 7;
}

/**
 * The month heatmap for `localDate`. Day intensity = strict-`done` habits / total
 * non-archived habits (clamped). A zero-completion day strictly between two active
 * days no more than `GRACE_DAYS + 1` apart is a hollow grace ring — exactly the gap
 * `computeStreak` bridges (D-D). Future days render empty (never grace).
 */
function buildHeatmap(
  localDate: string,
  totalHabits: number,
  doneByDate: ReadonlyMap<string, number>,
): { weeks: (HeatmapDay | null)[][] } {
  const [year, month] = localDate.split("-").map((p) => Number.parseInt(p, 10));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const todayNum = toDayNumber(localDate);

  // Active days (fraction > 0) across the WHOLE history, sorted ascending — used for
  // the grace-neighbour test so a bridge can reach just outside the rendered month.
  const activeDates = [...doneByDate.entries()]
    .filter(([, count]) => count > 0)
    .map(([date]) => date)
    .sort();

  const isGrace = (date: string): boolean => {
    if ((doneByDate.get(date) ?? 0) > 0) return false; // already active, not a gap
    if (toDayNumber(date) > todayNum) return false; // future days are never grace
    let prev: string | null = null;
    let next: string | null = null;
    for (const active of activeDates) {
      if (active < date) prev = active;
      else if (active > date) {
        next = active;
        break;
      }
    }
    if (prev === null || next === null) return false;
    return daysBetween(prev, next) <= GRACE_DAYS + 1;
  };

  const days: HeatmapDay[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${pad2(month)}-${pad2(d)}`;
    const doneCount = doneByDate.get(date) ?? 0;
    days.push({
      localDate: date,
      dayOfMonth: d,
      doneCount,
      total: totalHabits,
      fraction: totalHabits > 0 ? Math.min(doneCount / totalHabits, 1) : 0,
      grace: isGrace(date),
    });
  }

  // Pad to Monday-start whole weeks.
  const cells: (HeatmapDay | null)[] = [];
  for (let i = 0; i < mondayIndex(days[0].localDate); i++) cells.push(null);
  cells.push(...days);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks };
}

/**
 * Build the pure Habits read-model. Archived habits are excluded everywhere (rows,
 * headline, heatmap denominators). Tickability is DERIVED, not stored: a row is
 * hand-tickable iff `satisfiedBy === null` (the D-A boundary — no new field).
 */
export function buildHabitsView(input: HabitsInput): HabitsView {
  const { localDate, habits, logs, rules, ruleTotals } = input;
  const active = habits.filter((h) => !h.isArchived).slice().sort(compareRecords);
  const activeIds = new Set(active.map((h) => h.id));

  // Today's live log per habit, and per-habit active-date sets for the flames.
  const todayByHabit = new Map<string, HabitLogRecord>();
  const activeDatesByHabit = new Map<string, string[]>();
  const doneByDate = new Map<string, number>();
  for (const log of logs) {
    if (!activeIds.has(log.habitId)) continue;
    if (log.localDate === localDate) todayByHabit.set(log.habitId, log);
    if (STREAK_ACTIVE.has(log.status)) {
      const dates = activeDatesByHabit.get(log.habitId);
      if (dates) dates.push(log.localDate);
      else activeDatesByHabit.set(log.habitId, [log.localDate]);
    }
    if (log.status === "done") {
      doneByDate.set(log.localDate, (doneByDate.get(log.localDate) ?? 0) + 1);
    }
  }

  // First satisfaction rule per habit (deterministic) ⇒ rule-bearing.
  const ruleByHabit = new Map<string, HabitSatisfactionRuleRecord>();
  for (const rule of [...rules].sort(compareRecords)) {
    if (!activeIds.has(rule.habitId)) continue;
    if (!ruleByHabit.has(rule.habitId)) ruleByHabit.set(rule.habitId, rule);
  }

  let done = 0;
  const rows: HabitRow[] = active.map((habit) => {
    const todayLog = todayByHabit.get(habit.id) ?? null;
    const today = todayLog ? todayLog.status : "unlogged";
    if (today === "done") done += 1;
    const source: HabitRow["source"] = todayLog
      ? todayLog.source === "satisfied-by"
        ? "satisfied-by"
        : "manual"
      : null;

    const rule = ruleByHabit.get(habit.id) ?? null;
    const satisfiedBy: HabitSatisfiedBy | null = rule
      ? {
          hint: ruleHint(rule),
          sourceDomain: rule.sourceDomain,
          todayTotal: ruleTotals.get(rule.id) ?? null,
          targetValue: habit.targetValue,
          targetUnit: habit.targetUnit,
        }
      : null;

    return {
      habitId: habit.id,
      name: habit.name,
      streak: computeStreak(activeDatesByHabit.get(habit.id) ?? [], localDate, GRACE_DAYS),
      today,
      source,
      satisfiedBy,
    };
  });

  return {
    localDate,
    headline: { done, total: active.length },
    rows,
    heatmap: buildHeatmap(localDate, active.length, doneByDate),
  };
}

/**
 * The committed source rows for a rule's `sourceKind` — the SAME seven-kind switch as
 * `core/capture/commit.ts:sourceRowsForKind` (writer + reader must stay in lockstep;
 * the D-H test pins these seven). Unknown kind → no rows.
 */
async function sourceRowsForKind(
  repos: UserScopedRepositories,
  sourceKind: string,
): Promise<Record<string, unknown>[]> {
  const asRows = (rows: readonly unknown[]) => rows as Record<string, unknown>[];
  switch (sourceKind) {
    case "skillSession":
      return asRows(await repos.skills.sessions.list({}));
    case "workout":
      return asRows(await repos.health.workouts.list({}));
    case "water":
      return asRows(await repos.health.waterLogs.list({}));
    case "meal":
      return asRows(await repos.health.meals.list({}));
    case "transaction":
      return asRows(await repos.money.transactions.list({}));
    case "weighIn":
      return asRows(await repos.health.weighIns.list({}));
    case "habitLog":
      return asRows(await repos.habits.logs.list({}));
    default:
      return [];
  }
}

/**
 * Live integer aggregate per satisfaction rule for `localDate`, keyed by rule id. A
 * repos-taking core function (still framework-clean — the repo edge is injected, same
 * as `core/capture`). Unknown source-kind → `null` (the row still renders its hint,
 * just no live number). Non-finite fields contribute 0.
 */
export async function resolveRuleDayTotals(
  repos: UserScopedRepositories,
  rules: readonly HabitSatisfactionRuleRecord[],
  localDate: string,
): Promise<Map<string, number | null>> {
  const totals = new Map<string, number | null>();
  const rowsByKind = new Map<string, Record<string, unknown>[]>();
  for (const rule of rules) {
    let rows = rowsByKind.get(rule.sourceKind);
    if (!rows) {
      rows = await sourceRowsForKind(repos, rule.sourceKind);
      rowsByKind.set(rule.sourceKind, rows);
    }
    if (NOUN_BY_KIND[rule.sourceKind] === undefined) {
      totals.set(rule.id, null); // unknown kind — no live aggregate
      continue;
    }
    const total = rows
      .filter((row) => row.localDate === localDate)
      .reduce((sum, row) => sum + toInt(row[rule.aggregateField]), 0);
    totals.set(rule.id, total);
  }
  return totals;
}

/** The toggle decision for the one manual-tick write path (D-A). Pure + keyless. */
export type ManualTickPlan =
  | { op: "refuse" }
  | { op: "noop" }
  | { op: "create"; status: "done" }
  | { op: "update"; id: string; patch: { status: "done" | "skipped"; source: "manual" } };

/**
 * Decide the single-row, in-place toggle for a rule-free habit's manual tick (D-A).
 * The boundary invariant enforced in core: a rule-bearing habit (`hasActiveRules`) or
 * a day already claimed by a `satisfied-by` row REFUSES. Otherwise the day's row is
 * mutated in place (never soft-deleted — the full unique index does not exclude
 * tombstones): create/`done` on an empty day, `status:"done"` on tick, `status:
 * "skipped"` on clear (the only user-retraction state), no-op on clear-without-row.
 */
export function planManualTick(input: {
  todayRow: HabitLogRecord | null;
  hasActiveRules: boolean;
  next: "done" | "clear";
}): ManualTickPlan {
  const { todayRow, hasActiveRules, next } = input;
  if (hasActiveRules) return { op: "refuse" };
  if (todayRow && todayRow.source === "satisfied-by") return { op: "refuse" };

  if (next === "done") {
    if (todayRow) return { op: "update", id: todayRow.id, patch: { status: "done", source: "manual" } };
    return { op: "create", status: "done" };
  }
  // next === "clear"
  if (todayRow) return { op: "update", id: todayRow.id, patch: { status: "skipped", source: "manual" } };
  return { op: "noop" };
}

/**
 * Execute a manual tick end-to-end against the user-scoped repos (D-A). A repos-taking
 * core executor (framework-clean — the repo edge is injected) so the server action is a
 * thin wrapper and this exact write path is provable against real SQLite. `localDate`
 * is derived from `nowIso` (server-supplied — no client backdating). Refuse throws;
 * the toggle mutates the day's single row IN PLACE (never softDelete → no collision on
 * the full `(userId, habitId, localDate)` unique index). Returns the plan it ran.
 */
export async function executeManualTick(
  repos: UserScopedRepositories,
  habitId: string,
  next: "done" | "clear",
  nowIso: string,
): Promise<ManualTickPlan> {
  const localDate = nowIso.slice(0, 10);
  // A forged habitId (not under the caller's scoped repos) writes NOTHING — no orphan
  // habit_logs row (invariant: ask-don't-invent; typed writes only into owned rows).
  const habit = await repos.habits.habits.byId(habitId);
  if (!habit) return { op: "noop" };
  const [rules, todayLogs] = await Promise.all([
    repos.habits.satisfactionRules.list({ habitId }),
    repos.habits.logs.list({ habitId, localDate }),
  ]);
  const plan = planManualTick({ todayRow: todayLogs[0] ?? null, hasActiveRules: rules.length > 0, next });
  switch (plan.op) {
    case "refuse":
      throw new Error("habit is satisfied by a rule; manual tick refused");
    case "create":
      await repos.habits.logs.create({
        habitId,
        occurredAt: nowIso,
        localDate,
        timezone: "UTC",
        status: plan.status,
        source: "manual",
        note: null,
      });
      break;
    case "update":
      await repos.habits.logs.update(plan.id, plan.patch);
      break;
    case "noop":
      break;
  }
  return plan;
}
