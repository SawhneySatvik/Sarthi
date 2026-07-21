/**
 * core/onboarding/accept.ts — SAR-012 Pass 2 (D-F). The single atomic D-accept write.
 *
 * `createAcceptOnboardingService({repos, now})` is framework-clean: the scoped typed
 * repositories are INJECTED (core never imports the driver, invariant #5). It copies the
 * SHAPE of `core/capture/commit.ts` — single-flight per scope, one `repos.transaction`,
 * typed per-domain creates (invariant #6) — but deliberately DIVERGES in three ways:
 *   1. NO gateway: the Day-1 coach line is a DETERMINISTIC static string, written INSIDE
 *      the transaction (not a post-txn model call). So the service takes no `llm`.
 *   2. NO undo envelope / no `CommitService`: onboarding rows are user-confirmed plan
 *      DEFINITIONS, editable/archivable later — not a 5-minute-undoable capture batch.
 *   3. Idempotency: a second accept short-circuits to a replay no-op summary, so the
 *      arcs/items/budgets/coach-note (which carry no unique constraint) never double-write.
 *      The pre-transaction profile-complete guard is only the FAST PATH; the real
 *      cross-request guarantee is a re-read of onboardingStatus INSIDE the transaction (a
 *      concurrent loser sees 'complete' and replays), with the profile PK (= userId) as the
 *      txn's first write for defense-in-depth. The per-instance single-flight lock is NOT it.
 *      Named rows (categories/habits/skills/milestones/progress/snapshots/gaps) are ALSO
 *      create-if-missing, which additionally absorbs a pre-seeded dev DB carrying canonical
 *      entities (unique-constraint-safe) and wires FKs to the pre-existing row.
 *
 * Nothing estimated writes unconfirmed (invariant #1): the whole write only runs on the
 * user's D-tap; the spines are reviewed plan definitions, never estimated entries; and
 * before this call there is no profile row at all, so "zero rows before D-accept" holds.
 *
 * Integer units only (invariant #2): the input is re-validated server-side with zod —
 * every metric/target/limit is `int`, so a float dies at this boundary, not in the DB.
 */
import type { Domain } from "@/data/schema/contract";
import { z } from "zod";

import type { UserScopedRepositories } from "@/core/contracts";
import { localDateInZone } from "@/core/time";

import { coreAnswersSchema } from "./contract";
import {
  domainSpineSchema,
  selectedSpineDomains,
  SPINE_DOMAINS,
  type DomainSpine,
  type SpineDomain,
  type SpinePlanItem,
} from "./spine";

/* ── the contract ────────────────────────────────────────────────────────── */

/** True iff `timeZone` is a resolvable IANA zone. `Intl.DateTimeFormat` throws RangeError on
 *  junk, so validating here closes the RangeError-500 at the boundary (CF-5). `Intl` is a JS
 *  global, not a framework import — invariant #9 (framework-import-clean core) still holds. */
function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const acceptOnboardingInputSchema = z
  .object({
    answers: coreAnswersSchema,
    // ≥1 spine (CF-4): an empty array would flip the profile to 'complete' with no plan, and
    // onboarding is then unrepeatable. Domain uniqueness + the selected-subset are enforced in
    // the refines below, so a duplicate/orphan domain fails as a boundary 400 here rather than
    // as a mid-transaction unique-constraint 500 (or a silently bad account).
    spines: z.array(domainSpineSchema).min(1),
    // A resolvable IANA zone (CF-5): junk otherwise reaches `Intl.DateTimeFormat` and throws.
    timezone: z.string().min(1).refine(isValidTimeZone, { message: "timezone must be a valid IANA zone" }),
  })
  .refine((value) => new Set(value.spines.map((spine) => spine.domain)).size === value.spines.length, {
    message: "spines must not repeat a domain",
    path: ["spines"],
  })
  .refine(
    (value) => {
      const selected = new Set<SpineDomain>(selectedSpineDomains(value.answers));
      return value.spines.every((spine) => selected.has(spine.domain));
    },
    { message: "every spine domain must have been selected in the answers", path: ["spines"] },
  );
export type AcceptOnboardingInput = z.infer<typeof acceptOnboardingInputSchema>;

export interface AcceptedCounts {
  categories: number;
  /** Budget rows created (named `monthlyLimits` so the paise-only money guard ignores it). */
  monthlyLimits: number;
  habits: number;
  satisfactionRules: number;
  skills: number;
  milestones: number;
  arcs: number;
  items: number;
  progress: number;
  snapshots: number;
  gaps: number;
}

export interface AcceptOnboardingResult {
  status: "accepted" | "replayed";
  profileCreated: boolean;
  created: AcceptedCounts;
  coachNoteId: string | null;
}

export interface AcceptOnboardingService {
  accept(input: AcceptOnboardingInput): Promise<AcceptOnboardingResult>;
}

export interface CreateAcceptOnboardingServiceOptions {
  repos: UserScopedRepositories;
  now?: () => string;
}

/* ── static plan copy (deterministic; no model) ──────────────────────────── */

const ARC_TITLE: Record<SpineDomain, string> = {
  health: "Health · first days",
  money: "Money · first days",
  habits: "Habits · first days",
  skills: "Skills · first days",
};

/** The five DETAIL sections (E1–E5) enqueued `open` for the SAR-014 daily-brief backfill. */
const DETAIL_GAPS: ReadonlyArray<{ gapKey: string; prompt: string }> = [
  { gapKey: "detail-food", prompt: "Veg, egg, non-veg, or mixed most days?" },
  { gapKey: "detail-screen-time", prompt: "Roughly how much screen time on a normal day?" },
  { gapKey: "detail-focus", prompt: "Do you focus deeply, or get pulled away easily?" },
  { gapKey: "detail-career", prompt: "What's your work — and how far along is the skill?" },
  { gapKey: "detail-money", prompt: "Roughly, monthly income and any fixed bills?" },
];

/** Prompt for an UN-selected domain's `goal-<domain>` gap. */
const DOMAIN_GAP_PROMPT: Record<SpineDomain, string> = {
  health: "Want a Health plan too? Tell me one goal.",
  money: "Want to track money? Pick a starting point.",
  habits: "Any habit you'd like to build?",
  skills: "A skill you want to grow?",
};

/* ── date helpers (pure, timezone-correct) ───────────────────────────────── */

// `localDateInZone` now lives in the shared `@/core/time` module (D-053) — the private
// copy that used to sit here was lifted verbatim into it so every day-key boundary agrees.

/** The calendar-month window [first, last] containing a YYYY-MM-DD date. */
function monthWindow(localDate: string): { start: string; end: string } {
  const [year, month] = localDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
}

/** Health targets ARE its Day-1 items; the other domains carry `items` directly. */
function planItemsForSpine(spine: DomainSpine): SpinePlanItem[] {
  if (spine.domain === "health") {
    return spine.targets.map((target) => ({
      kind: target.kind,
      title: target.title,
      targetValue: target.targetValue,
      targetUnit: target.targetUnit,
      linkHabitName: null,
      linkSkillName: null,
    }));
  }
  return spine.items;
}

function zeroCounts(): AcceptedCounts {
  return {
    categories: 0,
    monthlyLimits: 0,
    habits: 0,
    satisfactionRules: 0,
    skills: 0,
    milestones: 0,
    arcs: 0,
    items: 0,
    progress: 0,
    snapshots: 0,
    gaps: 0,
  };
}

/* ── the service ─────────────────────────────────────────────────────────── */

export function createAcceptOnboardingService(
  options: CreateAcceptOnboardingServiceOptions,
): AcceptOnboardingService {
  const { repos } = options;
  const now = options.now ?? (() => new Date().toISOString());

  // Single-flight WITHIN THIS SERVICE INSTANCE (mirrors commit.ts): serialises a double-tap
  // that reuses THIS closure so `repos.transaction` is never re-entered. Each request builds a
  // NEW service, so this does NOT serialise across requests and is NOT the idempotency
  // mechanism — the in-transaction re-read of onboardingStatus (below) is.
  let tail: Promise<unknown> = Promise.resolve();
  function withLock<T>(work: () => Promise<T>): Promise<T> {
    const run = tail.then(work, work);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function accept(rawInput: AcceptOnboardingInput): Promise<AcceptOnboardingResult> {
    return withLock(async () => {
      // Server-side re-validation (integers re-enforced; a float dies here, not in the DB).
      const input = acceptOnboardingInputSchema.parse(rawInput);
      const nowIso = now();
      const today = localDateInZone(nowIso, input.timezone);

      // Fast-path idempotency guard: a complete profile ⇒ replay no-op WITHOUT opening a
      // transaction. This is an optimisation only; the authoritative check is the in-txn
      // re-read below (which also covers a concurrent request that raced past this point).
      const existingProfile = (await repos.profile.profiles.list({}))[0] ?? null;
      if (existingProfile && existingProfile.onboardingStatus === "complete") {
        return { status: "replayed", profileCreated: false, created: zeroCounts(), coachNoteId: null };
      }

      const selected = new Set<SpineDomain>(input.spines.map((spine) => spine.domain));
      const created = zeroCounts();
      let coachNoteId: string | null = null;
      let replayed = false;

      await repos.transaction(async () => {
        // The AUTHORITATIVE idempotency guarantee (CF-1): re-read onboardingStatus INSIDE the
        // transaction, before the first write. A concurrent request that committed first is now
        // 'complete', so this loser short-circuits to the SAME replay no-op instead of colliding
        // on the profile PK. Defense-in-depth: the profile create (PK = userId) is the txn's
        // FIRST write, so even an unread true-overlap race still aborts rather than duplicating.
        const profileInTxn = (await repos.profile.profiles.list({}))[0] ?? null;
        if (profileInTxn && profileInTxn.onboardingStatus === "complete") {
          replayed = true;
          return;
        }

        // a. Profile. Created with onboardingStatus:'complete' — the flip IS the commit
        // signal: the row is invisible until this single transaction commits, so the
        // task's "flip → complete" and D-F step (a) are the same atomic write. D-B
        // guarantees no profile exists pre-accept, so this is a create, not an upsert.
        await repos.profile.profiles.create({
          displayName: input.answers.displayName,
          birthDate: input.answers.birthDate,
          heightCm: input.answers.heightCm,
          weightGrams: input.answers.weightGrams,
          unitSystem: input.answers.unitSystem,
          theme: "bone",
          themeMode: "system",
          wakeTimeMinutes: input.answers.wakeTimeMinutes,
          sleepTimeMinutes: input.answers.sleepTimeMinutes,
          timeBudgetMinutes: input.answers.timeBudgetMinutes,
          // D-053: persist the onboarding zone (validated by the input schema's refine) so
          // every later day-key read resolves this user's true local day. `today` above is
          // already computed from it.
          timezone: input.timezone,
          foodPattern: null,
          screenTimeMinutes: null,
          focusPreference: null,
          careerGoal: null,
          moneyGoal: null,
          plan: "free",
          onboardingStatus: "complete",
          onboardingStep: 6,
          seedVersion: null,
        });

        // FK maps: named rows resolve to the id we created OR the pre-existing one.
        const habitIdByName = new Map<string, string>();
        const skillIdByName = new Map<string, string>();

        // b. Money — categories create-if-missing by (name, kind) case-folded, then a budget
        // row for each category with a monthly limit. Newly-created rows are pushed back into
        // `existingCategories` so a SECOND payload row with the same case-folded name resolves
        // to the first row instead of colliding on the (case-sensitive) unique index (CF-2).
        const moneySpine = input.spines.find((spine) => spine.domain === "money");
        if (moneySpine) {
          // Mutable copy: created rows are pushed back so later payload rows dedupe against them.
          const existingCategories = [...(await repos.money.categories.list({}))];
          for (const category of moneySpine.categories) {
            let row =
              existingCategories.find(
                (c) => c.name.toLowerCase() === category.name.toLowerCase() && c.kind === category.kind,
              ) ?? null;
            if (!row) {
              row = await repos.money.categories.create({
                name: category.name,
                kind: category.kind,
                colorKey: null,
                isSystem: false,
              });
              existingCategories.push(row);
              created.categories += 1;
            }
            if (category.monthlyLimitPaise !== null) {
              const { start, end } = monthWindow(today);
              const existingBudgets = await repos.money.budgets.list({ categoryId: row.id });
              if (!existingBudgets.some((b) => b.periodStart === start)) {
                await repos.money.budgets.create({
                  categoryId: row.id,
                  periodStart: start,
                  periodEnd: end,
                  limitPaise: category.monthlyLimitPaise,
                });
                created.monthlyLimits += 1;
              }
            }
          }
        }

        // c. Habits — create-if-missing by case-folded name (newly-created rows pushed back so
        // a duplicate name within one payload collapses to one row instead of colliding on the
        // case-sensitive unique index, CF-2), then any satisfaction rule.
        const habitsSpine = input.spines.find((spine) => spine.domain === "habits");
        if (habitsSpine) {
          // Mutable copy: created rows are pushed back so later payload rows dedupe against them.
          const existingHabits = [...(await repos.habits.habits.list({}))];
          for (const habit of habitsSpine.habits) {
            let row = existingHabits.find((h) => h.name.toLowerCase() === habit.name.toLowerCase()) ?? null;
            if (!row) {
              row = await repos.habits.habits.create({
                name: habit.name,
                cadence: habit.cadence,
                difficulty: habit.difficulty,
                targetValue: habit.targetValue,
                targetUnit: habit.targetUnit,
                isArchived: false,
              });
              existingHabits.push(row);
              created.habits += 1;
            }
            habitIdByName.set(habit.name.toLowerCase(), row.id);
            if (habit.satisfactionRule) {
              const rule = habit.satisfactionRule;
              const existingRules = await repos.habits.satisfactionRules.list({ habitId: row.id });
              const present = existingRules.some(
                (r) =>
                  r.sourceDomain === rule.sourceDomain &&
                  r.sourceKind === rule.sourceKind &&
                  r.aggregateField === rule.aggregateField,
              );
              if (!present) {
                await repos.habits.satisfactionRules.create({
                  habitId: row.id,
                  sourceDomain: rule.sourceDomain,
                  sourceKind: rule.sourceKind,
                  aggregateField: rule.aggregateField,
                  minimumValue: rule.minimumValue,
                  unit: rule.unit,
                });
                created.satisfactionRules += 1;
              }
            }
          }
        }

        // d. Skills — create-if-missing by name, then ordered milestones.
        const skillsSpine = input.spines.find((spine) => spine.domain === "skills");
        if (skillsSpine) {
          const existingSkills = await repos.skills.skills.list({});
          let row = existingSkills.find((s) => s.name.toLowerCase() === skillsSpine.skill.name.toLowerCase()) ?? null;
          if (!row) {
            row = await repos.skills.skills.create({
              name: skillsSpine.skill.name,
              targetMinutes: skillsSpine.skill.targetMinutes,
              isArchived: false,
            });
            created.skills += 1;
          }
          skillIdByName.set(skillsSpine.skill.name.toLowerCase(), row.id);
          // Mutable copy: created milestones are pushed back so a duplicate label collapses (CF-2).
          const existingMilestones = [...(await repos.skills.milestones.list({ skillId: row.id }))];
          // Start after the HIGHEST existing sortOrder, not the count (CF-8): a non-contiguous
          // pre-existing set like [2,3] would otherwise reuse 2 and collide on the unique index.
          let sortOrder = existingMilestones.reduce((max, m) => Math.max(max, m.sortOrder), -1) + 1;
          for (const label of skillsSpine.milestones) {
            if (!existingMilestones.some((m) => m.label.toLowerCase() === label.toLowerCase())) {
              const milestone = await repos.skills.milestones.create({
                skillId: row.id,
                label,
                sortOrder: sortOrder++,
                completedAt: null,
              });
              existingMilestones.push(milestone); // a duplicate label within one payload now collapses (CF-2)
              created.milestones += 1;
            }
          }
        }

        // e. One plan arc per selected domain + its Day-1 items (FKs wired to the rows above).
        // Arcs/items carry no unique constraint; the profile-complete guard makes this
        // replay-safe, and skipping a domain that already has an arc absorbs odd states.
        const existingArcs = await repos.plans.arcs.list({});
        for (const spine of input.spines) {
          if (existingArcs.some((arc) => arc.domain === spine.domain)) {
            continue;
          }
          const arc = await repos.plans.arcs.create({
            domain: spine.domain,
            mode: "build",
            title: ARC_TITLE[spine.domain],
            startDate: today,
            endDate: null,
            dayNumber: 1,
            status: "active",
          });
          created.arcs += 1;
          for (const item of planItemsForSpine(spine)) {
            await repos.plans.items.create({
              arcId: arc.id,
              domain: spine.domain,
              kind: item.kind,
              title: item.title,
              dueAt: null,
              localDate: today,
              targetValue: item.targetValue,
              targetUnit: item.targetUnit,
              status: "active",
              completionSource: null,
              ruleJson: null,
              linkedHabitId: item.linkHabitName ? habitIdByName.get(item.linkHabitName.toLowerCase()) ?? null : null,
              linkedSkillId: item.linkSkillName ? skillIdByName.get(item.linkSkillName.toLowerCase()) ?? null : null,
            });
            created.items += 1;
          }
        }

        // f. Progress zeroed — `overall` PLUS each selected domain (no unearned XP, no amber).
        const existingProgress = await repos.plans.progress.list({});
        const progressDomains: Domain[] = ["overall", ...selected];
        for (const domain of progressDomains) {
          if (!existingProgress.some((p) => p.domain === domain)) {
            await repos.plans.progress.create({
              domain,
              xp: 0,
              level: 1,
              streak: 0,
              bestStreak: 0,
              cumulativeMinutes: 0,
              lastActiveDate: null,
            });
            created.progress += 1;
          }
        }
        // Day-one snapshots — selected domains ONLY (the before/after baseline).
        const existingSnapshots = await repos.plans.dayOneSnapshots.list({});
        for (const spine of input.spines) {
          if (!existingSnapshots.some((s) => s.domain === spine.domain)) {
            await repos.plans.dayOneSnapshots.create({
              domain: spine.domain,
              snapshotDate: today,
              statsJson: {
                domain: spine.domain,
                asOfLocalDate: today,
                xp: 0,
                level: 1,
                streak: 0,
                bestStreak: 0,
                cumulativeMinutes: 0,
                metrics: [],
              },
            });
            created.snapshots += 1;
          }
        }

        // g. Gaps — the five DETAIL sections + one per UN-selected domain, create-if-missing
        // on the unique gapKey. The detail gaps are CREATED here (D-F g); Pass 3's E flow only
        // marks them `answered` or leaves them `open` (it never creates a gap), so they must
        // already exist by accept. Whatever stays `open` is consumed by the SAR-014 daily brief.
        const existingGaps = await repos.profile.gaps.list({});
        const gapSpecs: Array<{ gapKey: string; prompt: string }> = [...DETAIL_GAPS];
        for (const domain of SPINE_DOMAINS) {
          if (!selected.has(domain)) {
            gapSpecs.push({ gapKey: `goal-${domain}`, prompt: DOMAIN_GAP_PROMPT[domain] });
          }
        }
        for (const gap of gapSpecs) {
          if (!existingGaps.some((g) => g.gapKey === gap.gapKey)) {
            await repos.profile.gaps.create({
              gapKey: gap.gapKey,
              prompt: gap.prompt,
              optionsJson: null,
              status: "open",
              answeredAt: null,
            });
            created.gaps += 1;
          }
        }

        // h. The deterministic Day-1 coach note (D-F h) — a static line, inside the txn, so
        // G/Today shows the coach's first line without the SAR-014 engine. No gateway call.
        const existingNotes = await repos.coach.notes.list({ scope: "daily" });
        const existingNote = existingNotes.find((note) => note.stalenessKey === "onboarding-day1");
        if (existingNote) {
          coachNoteId = existingNote.id;
        } else {
          const note = await repos.coach.notes.create({
            scope: "daily",
            localDate: today,
            text: `Day 1, ${input.answers.displayName}. Small and consistent beats big and rare.`,
            modelProvider: "system",
            modelId: "onboarding-day1",
            evidenceJson: { generatedForLocalDate: today, items: [] },
            stalenessKey: "onboarding-day1",
          });
          coachNoteId = note.id;
        }
      });

      // A concurrent loser detected the complete profile inside the txn (committed nothing).
      if (replayed) {
        return { status: "replayed", profileCreated: false, created: zeroCounts(), coachNoteId: null };
      }
      return { status: "accepted", profileCreated: true, created, coachNoteId };
    });
  }

  return { accept };
}
