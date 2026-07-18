/**
 * data/seed/demo.ts — SAR-012 Pass 3 (D-G / D-033). The populated demo seed, LIFTED out of
 * `scripts/seed-dev.ts` into one shared, repo-typed function so the dev script AND the in-app
 * long-press gesture (`POST /api/dev/seed-demo`) stay a SINGLE seed. Framework-clean (repos +
 * the drizzle-free `@/data/schema/contract` DTO edge only): the file reset / migrations /
 * driver stay in the script — this only writes through the scoped typed repositories.
 *
 * Idempotent (D-033): guarded by the `seed_runs` ledger (`seedKey 'dev-demo-v1'`, unique
 * `(userId,seedKey)`) — a second run short-circuits, so the gesture is judge-safe to tap
 * twice and never duplicates. The whole body runs in ONE `repos.transaction`, so a partial
 * failure rolls back and leaves no ledger row (re-runnable). Integer units only (invariant
 * #2): every quantity is paise / ml / minutes / grams. Keyless.
 */
import type { UserScopedRepositories } from "@/core/contracts";

import { seedCanonicalEntities } from "./canonical";

/** The demo seed's ledger identity (D-033). */
export const DEMO_SEED_KEY = "dev-demo-v1";
export const DEMO_SEED_VERSION = 1;

/** The dev/screenshot states the shared body can produce (§10). `populated` is the demo. */
export type DemoSeedState = "populated" | "empty" | "alldone";

export interface SeedDemoResult {
  /** True when the body ran; false when the `seed_runs` guard short-circuited a replay. */
  seeded: boolean;
}

function isoDaysFromToday(delta: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** The full populated write (profile → canonical → plan/health/habits/money/skills → coach).
 *  `state` toggles the two dev-only screenshot variants; the gesture always uses `populated`. */
async function seedBody(repos: UserScopedRepositories, state: DemoSeedState): Promise<void> {
  const today = isoDaysFromToday(0);

  // Profile — create-if-missing (the gesture may run for a user who has none yet). A COMPLETE
  // profile so the SAR-012 onboarding gate passes and Today renders the populated demo.
  const existingProfile = (await repos.profile.profiles.list({}))[0] ?? null;
  if (!existingProfile) {
    await repos.profile.profiles.create({
      displayName: "Satvik",
      birthDate: "1998-03-14",
      heightCm: 178,
      weightGrams: 74000,
      unitSystem: "metric",
      theme: "ember",
      themeMode: "dark",
      wakeTimeMinutes: 330,
      sleepTimeMinutes: 1380,
      timeBudgetMinutes: 60,
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
  }

  // The entities the canonical capture fixture resolves against (F3 strip; D-K). Idempotent.
  await seedCanonicalEntities(repos);

  if (state === "empty") {
    // New-user / nothing-planned Today: canonical entities exist (capture still works), no arc.
    return;
  }

  const arc = await repos.plans.arcs.create({
    domain: "overall",
    mode: "build",
    title: "First 30 days",
    startDate: isoDaysFromToday(-11),
    endDate: isoDaysFromToday(18),
    dayNumber: 12,
    status: "active",
  });

  await repos.plans.progress.create({ domain: "overall", xp: 1240, level: 4, streak: 6, bestStreak: 8, cumulativeMinutes: 7710, lastActiveDate: today });
  await repos.plans.progress.create({ domain: "health", xp: 120, level: 2, streak: 4, bestStreak: 4, cumulativeMinutes: 0, lastActiveDate: today });
  await repos.plans.progress.create({ domain: "skills", xp: 260, level: 2, streak: 6, bestStreak: 6, cumulativeMinutes: 900, lastActiveDate: today });
  await repos.plans.progress.create({ domain: "money", xp: 140, level: 2, streak: 3, bestStreak: 5, cumulativeMinutes: 0, lastActiveDate: today });
  await repos.plans.progress.create({ domain: "habits", xp: 180, level: 2, streak: 6, bestStreak: 8, cumulativeMinutes: 0, lastActiveDate: today });
  // Day-one is a before/after baseline for the four real domains only; Overall is derived.
  for (const domain of ["health", "money", "habits", "skills"] as const) {
    await repos.plans.dayOneSnapshots.create({ domain, snapshotDate: isoDaysFromToday(-11), statsJson: { domain, asOfLocalDate: isoDaysFromToday(-11), xp: 0, level: 1, streak: 0, bestStreak: 0, cumulativeMinutes: 0, metrics: [] } });
  }

  const item = (over: Partial<Parameters<typeof repos.plans.items.create>[0]>) =>
    repos.plans.items.create({
      arcId: arc.id,
      domain: "health",
      kind: "task",
      title: "",
      dueAt: null,
      localDate: today,
      targetValue: null,
      targetUnit: null,
      status: "active",
      completionSource: null,
      ruleJson: null,
      linkedHabitId: null,
      linkedSkillId: null,
      ...over,
    });

  // In `alldone`, the open items are completed (Today collapses to the celebration state).
  const done = state === "alldone";
  await item({ domain: "skills", kind: "target", title: "Deep work: system design", targetValue: 30, targetUnit: "minutes", status: done ? "done" : "active", completionSource: done ? "manual" : null });
  await item({ domain: "health", title: "Log lunch", status: done ? "done" : "pending", completionSource: done ? "manual" : null });
  await item({ domain: "habits", title: "Evening walk", status: done ? "done" : "pending", completionSource: done ? "manual" : null });
  await item({ domain: "health", title: "Drink water", status: "done", completionSource: "capture" });
  await item({ domain: "habits", title: "Meditate 10m", status: "done", completionSource: "manual" });

  // A couple of Health entries so the Health lens rings render with data.
  const breakfast = await repos.health.meals.create({
    occurredAt: `${today}T07:30:00.000Z`, localDate: today, timezone: "UTC",
    kcal: 620, proteinGrams: 24, carbsGrams: 78, fatGrams: 18,
    source: "capture", confidenceBps: 9000, estimated: false, evidenceId: null, note: "Breakfast",
  });
  const recoveryMealDate = isoDaysFromToday(-6);
  const recoveryMeal = await repos.health.meals.create({
    occurredAt: `${recoveryMealDate}T12:30:00.000Z`, localDate: recoveryMealDate, timezone: "UTC",
    kcal: 710, proteinGrams: 38, carbsGrams: 84, fatGrams: 22,
    source: "capture", confidenceBps: 9000, estimated: false, evidenceId: null, note: "Post-workout lunch",
  });
  await repos.health.waterLogs.create({
    occurredAt: `${today}T09:00:00.000Z`, localDate: today, timezone: "UTC",
    millilitres: 900, source: "capture", confidenceBps: 9500, estimated: false,
  });

  // ── Habits slice (SAR-009 D-G): rule-free habits with a grace-gapped log history so the
  // streak flames + month heatmap render (including hollow grace rings on bridged misses),
  // plus one satisfied-by habit ("Water", target 2,000 ml) whose live metric reads
  // unsatisfied by default (only 900 ml today) and flips to a ⚡-done state under `alldone`.
  const seededHabits = await repos.habits.habits.list({});
  const wakeHabit = seededHabits.find((h) => h.name.toLowerCase() === "wake by 5:30 am")!;
  const meditateHabit = await repos.habits.habits.create({ name: "Meditate", cadence: "daily", difficulty: "easy", targetValue: 10, targetUnit: "minutes", isArchived: false });
  const noSugarHabit = await repos.habits.habits.create({ name: "No sugar", cadence: "daily", difficulty: "hard", targetValue: null, targetUnit: null, isArchived: false });
  const waterHabit = await repos.habits.habits.create({ name: "Water", cadence: "daily", difficulty: "medium", targetValue: 2000, targetUnit: "ml", isArchived: false });
  await repos.habits.satisfactionRules.create({
    habitId: waterHabit.id, sourceDomain: "health", sourceKind: "water", aggregateField: "millilitres", minimumValue: 2000, unit: "ml",
  });

  const habitLog = (habitId: string, delta: number) => {
    const d = isoDaysFromToday(delta);
    return repos.habits.logs.create({ habitId, occurredAt: `${d}T07:00:00.000Z`, localDate: d, timezone: "UTC", status: "done", source: "manual", note: null });
  };
  // Global active days = {0,-1,-3,-4,-6,-8}; the empty -2/-5/-7 days sit between active
  // neighbours ≤ GRACE_DAYS+1 apart → each renders a hollow grace ring, not a gap.
  const meditateLogs = await Promise.all([0, -1, -3, -4, -6, -8].map((delta) => habitLog(meditateHabit.id, delta)));
  await Promise.all([0, -1, -3, -4].map((delta) => habitLog(noSugarHabit.id, delta)));
  const wakeLogs = await Promise.all([-1, -3, -6, -8].map((delta) => habitLog(wakeHabit.id, delta))); // unlogged today → a tickable rule-free row
  if (done) {
    // alldone: cross the 2,000 ml threshold and materialize the satisfied-by completion.
    await repos.health.waterLogs.create({ occurredAt: `${today}T15:00:00.000Z`, localDate: today, timezone: "UTC", millilitres: 1400, source: "capture", confidenceBps: 9500, estimated: false });
    await repos.habits.logs.create({ habitId: waterHabit.id, occurredAt: `${today}T15:00:00.000Z`, localDate: today, timezone: "UTC", status: "done", source: "satisfied-by", note: null });
  }

  // ── Money slice (SAR-008 D-F): a hand-checkable current-month ledger so the Money lens
  // renders real content (not Day-1 empty). Integer paise only. Food ≈78%, Transport 95%.
  const [yy, mm] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${yy}-${pad(mm)}-01`;
  const monthEnd = `${yy}-${pad(mm)}-${pad(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`;
  const nextMonthFirst = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${pad(mm + 1)}-01`;
  const earlier = Number(today.slice(8, 10)) > 1 ? isoDaysFromToday(-1) : today;
  const aheadInMonth = (delta: number): string => {
    const target = isoDaysFromToday(delta);
    return target > today && target <= monthEnd ? target : monthEnd;
  };

  const moneyCats = await repos.money.categories.list({});
  const foodCat = moneyCats.find((c) => c.name.toLowerCase() === "food & dining")!;
  const transportCat = await repos.money.categories.create({ name: "Transport", kind: "expense", colorKey: null, isSystem: false });
  const rentCat = await repos.money.categories.create({ name: "Rent", kind: "expense", colorKey: null, isSystem: false });
  const salaryCat = await repos.money.categories.create({ name: "Salary", kind: "income", colorKey: null, isSystem: false });

  const salaryRule = await repos.money.recurringRules.create({
    direction: "credit", amountPaise: 12000000, categoryId: salaryCat.id, merchant: "Acme Payroll", cadence: "monthly", nextPostDate: nextMonthFirst, isPaused: false,
  });
  await repos.money.recurringRules.create({
    direction: "debit", amountPaise: 2500000, categoryId: rentCat.id, merchant: "Rent", cadence: "monthly", nextPostDate: aheadInMonth(3), isPaused: false,
  });
  await repos.money.recurringRules.create({
    direction: "debit", amountPaise: 11900, categoryId: null, merchant: "Spotify", cadence: "monthly", nextPostDate: aheadInMonth(5), isPaused: false,
  });

  const tx = (over: Partial<Parameters<typeof repos.money.transactions.create>[0]>) =>
    repos.money.transactions.create({
      occurredAt: `${today}T12:00:00.000Z`, localDate: today, timezone: "UTC",
      direction: "debit", amountPaise: 0, categoryId: null, merchant: null, note: null,
      source: "capture", confidenceBps: 9000, estimated: false, evidenceId: null, recurringRuleId: null,
      ...over,
    });
  // Salary posted this month (credit, links the shelf chip's ↻).
  await tx({ direction: "credit", amountPaise: 12000000, categoryId: salaryCat.id, merchant: "Acme Payroll", localDate: earlier, occurredAt: `${earlier}T09:00:00.000Z`, recurringRuleId: salaryRule.id });
  // Food & dining → 6,240 of the 8,000 budget (78%).
  await tx({ amountPaise: 34000, categoryId: foodCat.id, merchant: "Lunch", occurredAt: `${today}T13:00:00.000Z` });
  await tx({ amountPaise: 52000, categoryId: foodCat.id, merchant: "Swiggy dinner", estimated: true, confidenceBps: 6200, occurredAt: `${today}T20:30:00.000Z` });
  const groceries = await tx({ amountPaise: 538000, categoryId: foodCat.id, merchant: "BigBasket", localDate: earlier, occurredAt: `${earlier}T18:00:00.000Z` });
  // Transport → 1,900 of 2,000 (95% → warn bar).
  await tx({ amountPaise: 190000, categoryId: transportCat.id, merchant: "Uber", occurredAt: `${today}T08:15:00.000Z` });
  // One uncategorized debit (nullable categoryId → Uncategorized bucket).
  await tx({ amountPaise: 25000, categoryId: null, note: "Chai + snacks", occurredAt: `${today}T16:00:00.000Z` });

  await repos.money.budgets.create({ categoryId: foodCat.id, periodStart: monthStart, periodEnd: monthEnd, limitPaise: 800000 });
  await repos.money.budgets.create({ categoryId: transportCat.id, periodStart: monthStart, periodEnd: monthEnd, limitPaise: 200000 });

  // ── Skills slice (SAR-010 D-F): give the canonical "System design" skill a 500h target, a
  // curriculum, and a believable session history so the mastery counter is the hero (7,710
  // min = 128:30, past the 100h tier), plus a sparse dormant "DSA" track. Integer minutes only.
  const skillMilestone = (skillId: string, sortOrder: number, label: string, completedDelta: number | null) =>
    repos.skills.milestones.create({
      skillId,
      label,
      sortOrder,
      completedAt: completedDelta === null ? null : `${isoDaysFromToday(completedDelta)}T10:00:00.000Z`,
    });
  const skillSession = (
    skillId: string,
    delta: number,
    minutes: number,
    over: Partial<Parameters<typeof repos.skills.sessions.create>[0]> = {},
  ) => {
    const d = isoDaysFromToday(delta);
    return repos.skills.sessions.create({
      skillId,
      occurredAt: `${d}T18:00:00.000Z`,
      localDate: d,
      timezone: "UTC",
      minutes,
      source: "typed",
      note: null,
      confidenceBps: 10000,
      estimated: false,
      ...over,
    });
  };

  const seededSkills = await repos.skills.skills.list({});
  const systemDesign = seededSkills.find((s) => s.name.toLowerCase() === "system design")!;
  await repos.skills.skills.update(systemDesign.id, { targetMinutes: 30000 }); // 500h target
  await skillMilestone(systemDesign.id, 1, "Fundamentals: latency, throughput, CAP", -20);
  await skillMilestone(systemDesign.id, 2, "Caching & CDNs", -9);
  await skillMilestone(systemDesign.id, 3, "Data partitioning & sharding", null); // ▸ current
  await skillMilestone(systemDesign.id, 4, "Consensus & replication", null);
  await skillMilestone(systemDesign.id, 5, "Design a global feed", null);
  // System design mastery accretes over believable 45–180 min blocks. Recent 10 = 1,110 min.
  await skillSession(systemDesign.id, 0, 120, { source: "capture", confidenceBps: 9000, note: "Deep work: system design" });
  await skillSession(systemDesign.id, -1, 90, { note: "Consistent hashing deep-dive" });
  await skillSession(systemDesign.id, -2, 90, { source: "capture", estimated: true, confidenceBps: 6200, note: "Design review prep" });
  await skillSession(systemDesign.id, -3, 150, { note: "DDIA ch. 6 — partitioning" });
  await skillSession(systemDesign.id, -4, 75, { note: "Kafka internals" });
  await skillSession(systemDesign.id, -6, 135, { note: "Distributed systems course" });
  await skillSession(systemDesign.id, -7, 60, { note: "Rate limiter design" });
  const shardingSession = await skillSession(systemDesign.id, -9, 165, { note: "Sharding strategies" });
  const capReviewSession = await skillSession(systemDesign.id, -11, 105, { note: "CAP theorem review" });
  await skillSession(systemDesign.id, -13, 120, { note: "Load balancing patterns" });
  // Backfill older than the 10-row log window: 36 × 180 + 1 × 120 = 6,600 min. Lifetime
  // mastery = 1,110 + 6,600 = 7,710 min = 128:30 (past the 100h tier).
  for (let d = 15; d <= 50; d += 1) await skillSession(systemDesign.id, -d, 180, { note: "Focused practice block" });
  await skillSession(systemDesign.id, -51, 120, { note: "Focused practice block" });

  // Dormant track: last practiced 20 days ago (>14d) → the lens dims its card decoration.
  const dsa = await repos.skills.skills.create({ name: "DSA", targetMinutes: 6000, isArchived: false });
  await skillMilestone(dsa.id, 1, "Arrays & hashing", -20);
  await skillMilestone(dsa.id, 2, "Two pointers", null); // ▸ current
  await skillMilestone(dsa.id, 3, "Sliding window", null);
  await skillSession(dsa.id, -25, 120, { source: "capture", note: "Linked lists" });
  await skillSession(dsa.id, -22, 150, { note: "Arrays + hashing drills" });
  await skillSession(dsa.id, -20, 90, { note: "Two-pointer patterns" });

  await repos.coach.notes.create({
    scope: "daily",
    localDate: today,
    text: "Five days in and steady. One focused block today keeps the streak alive.",
    modelProvider: "fake",
    modelId: "seed",
    evidenceJson: { generatedForLocalDate: today, items: [] },
    stalenessKey: "seed:today",
  });
  await repos.coach.notes.create({
    scope: "weekly", localDate: isoDaysFromToday(-3),
    text: "You train best when the morning starts early. Health held its ground, money stayed visible, and System Design kept compounding. Keep the next week light enough to repeat.",
    modelProvider: "fake", modelId: "seed", evidenceJson: { generatedForLocalDate: isoDaysFromToday(-3), items: [] }, stalenessKey: "seed:weekly",
  });
  const adaptable = (await repos.plans.items.list({})).find((planItem) => planItem.title === "Deep work: system design");
  if (adaptable && adaptable.targetValue !== null) {
    await repos.coach.adaptations.create({
      planItemId: adaptable.id,
      beforeJson: { entryKind: "planItem", entryId: adaptable.id, columns: { title: adaptable.title, targetValue: adaptable.targetValue, targetUnit: adaptable.targetUnit, status: adaptable.status } },
      afterJson: { entryKind: "planItem", entryId: adaptable.id, columns: { title: adaptable.title, targetValue: Math.max(1, adaptable.targetValue - 10), targetUnit: adaptable.targetUnit, status: adaptable.status } },
      reason: "Keep the first restart block lighter so it is easy to begin.", status: "proposed", keptAt: null, revertedAt: null, appliedCommitId: null,
    });
  }
  const evidence = (domain: "health" | "money" | "habits" | "skills", entryKind: string, entry: { id: string; occurredAt: string; localDate: string }, caption: string, suffix: string) => repos.evidence.create({ domain, entryKind, entryId: entry.id, storageProvider: "placeholder", storagePath: "", mimeType: "image/jpeg", sha256: `seed-${suffix}`, caption, occurredAt: entry.occurredAt, localDate: entry.localDate });
  await evidence("health", "meal", breakfast, "Breakfast · 620 kcal", "breakfast");
  await evidence("money", "transaction", groceries, "Grocery receipt · ₹5,380", "groceries");
  await evidence("habits", "habitLog", meditateLogs[2]!, "Meditation check-in", "meditate-3");
  await evidence("habits", "habitLog", meditateLogs[3]!, "Evening reset", "meditate-4");
  await evidence("health", "meal", recoveryMeal, "Post-workout lunch · 710 kcal", "recovery-meal");
  await evidence("habits", "habitLog", wakeLogs[1]!, "Early wake check-in", "wake-3");
  await evidence("skills", "skillSession", shardingSession, "System Design notes · sharding", "sharding");
  await evidence("skills", "skillSession", capReviewSession, "CAP theorem review", "cap-review");
}

/**
 * Seed the demo for the current user. Idempotent via the `seed_runs` ledger: a prior run
 * short-circuits (returns `seeded:false`). The whole body + the ledger row commit in ONE
 * transaction, so a crash mid-seed leaves no ledger row and the seed can be re-run cleanly.
 */
export async function seedDemo(
  repos: UserScopedRepositories,
  options: { state?: DemoSeedState } = {},
): Promise<SeedDemoResult> {
  const state = options.state ?? "populated";

  const priorRuns = await repos.profile.seedRuns.list({ seedKey: DEMO_SEED_KEY });
  if (priorRuns.length > 0) {
    return { seeded: false };
  }

  await repos.transaction(async () => {
    await seedBody(repos, state);
    await repos.profile.seedRuns.create({
      seedKey: DEMO_SEED_KEY,
      seedVersion: DEMO_SEED_VERSION,
      completedAt: new Date().toISOString(),
    });
  });

  return { seeded: true };
}
