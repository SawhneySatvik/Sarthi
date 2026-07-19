/**
 * tests/onboarding-accept.test.ts — SAR-012 Pass 2 (D-F). The F1 keyless integration proof.
 *
 * Fresh scope → ZERO rows before the D-tap → generate spines (fake) → accept → exactly the
 * typed rows per selected-domain subset (profile complete, arcs/items, habits, skills +
 * milestones, money categories + budgets, zeroed progress[overall+selected] + day-one
 * snapshots[selected only], profile_gaps, the Day-1 coach note). Double-accept does NOT
 * double-write (the profile-complete guard replays). The 1-domain-only variant holds, and
 * a pre-existing named category is REUSED (FK wired to it), never duplicated.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type { LlmGateway, UserScopedRepositories } from "../core/contracts";
import {
  acceptOnboardingInputSchema,
  createAcceptOnboardingService,
  generateSpine,
  selectedSpineDomains,
  type CoreAnswers,
  type DomainSpine,
} from "../core/onboarding";
import { createRepositoryFactory } from "../data/repository";
import { createLlmGateway } from "../providers";
import { createMemoryDb } from "./helpers/memory-db";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const NOW = "2026-07-17T05:20:00.000Z";
const TODAY = "2026-07-17";

const ALL_DOMAINS: CoreAnswers = {
  displayName: "Satvik",
  birthDate: "1998-03-14",
  heightCm: 178,
  weightGrams: 74000,
  unitSystem: "metric",
  dayShape: "nine_to_five",
  wakeTimeMinutes: 330,
  sleepTimeMinutes: 1380,
  goals: {
    health: ["gym", "weight"],
    money: ["budget", "stop_leaks"],
    habits: ["wake_early", "focus"],
    skillName: "System design",
  },
  timeBudgetMinutes: 30,
};

let savedFetch: typeof globalThis.fetch;
const savedKeys: Record<string, string | undefined> = {};
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("onboarding-accept test must not hit the network");
  }) as typeof globalThis.fetch;
  for (const key of ["GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) {
    savedKeys[key] = process.env[key];
    delete process.env[key];
  }
});
after(() => {
  globalThis.fetch = savedFetch;
  for (const [key, value] of Object.entries(savedKeys)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function setup(llm: LlmGateway = createLlmGateway("fake")) {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const service = createAcceptOnboardingService({ repos, now: () => NOW });
  return { repos, service, llm };
}

async function generateSpines(answers: CoreAnswers, llm: LlmGateway): Promise<DomainSpine[]> {
  const spines: DomainSpine[] = [];
  for (const domain of selectedSpineDomains(answers)) {
    const result = await generateSpine({ domain, answers }, llm);
    assert.ok(result.ok, `generateSpine ${domain} should succeed on the fake`);
    if (result.ok) spines.push(result.spine);
  }
  return spines;
}

async function counts(repos: UserScopedRepositories) {
  return {
    profiles: (await repos.profile.profiles.list({})).length,
    categories: (await repos.money.categories.list({})).length,
    budgets: (await repos.money.budgets.list({})).length,
    habits: (await repos.habits.habits.list({})).length,
    skills: (await repos.skills.skills.list({})).length,
    milestones: (await repos.skills.milestones.list({})).length,
    arcs: (await repos.plans.arcs.list({})).length,
    items: (await repos.plans.items.list({})).length,
    progress: (await repos.plans.progress.list({})).length,
    snapshots: (await repos.plans.dayOneSnapshots.list({})).length,
    gaps: (await repos.profile.gaps.list({})).length,
    notes: (await repos.coach.notes.list({})).length,
  };
}

const ZERO = {
  profiles: 0,
  categories: 0,
  budgets: 0,
  habits: 0,
  skills: 0,
  milestones: 0,
  arcs: 0,
  items: 0,
  progress: 0,
  snapshots: 0,
  gaps: 0,
  notes: 0,
};

test("F1 — zero rows before the D-tap, then the full typed write across four domains", async () => {
  const { repos, service, llm } = await setup();
  assert.deepEqual(await counts(repos), ZERO, "nothing may exist before the accept tap");

  const spines = await generateSpines(ALL_DOMAINS, llm);
  const result = await service.accept({ answers: ALL_DOMAINS, spines, timezone: "UTC" });
  assert.equal(result.status, "accepted");
  assert.equal(result.profileCreated, true);

  // Profile flipped to complete (the commit signal), all metric integers.
  const profile = (await repos.profile.profiles.list({}))[0];
  assert.equal(profile.onboardingStatus, "complete");
  assert.equal(profile.onboardingStep, 6);
  assert.equal(profile.timeBudgetMinutes, 30);
  assert.equal(profile.plan, "free");

  // One arc per selected domain; every Day-1 item lands on today.
  const arcs = await repos.plans.arcs.list({});
  assert.equal(arcs.length, 4);
  assert.deepEqual(new Set(arcs.map((a) => a.domain)), new Set(["health", "money", "habits", "skills"]));
  const items = await repos.plans.items.list({});
  assert.ok(items.length > 0);
  assert.ok(items.every((i) => i.localDate === TODAY && i.status === "active"));

  // Progress = overall PLUS each selected domain; snapshots = selected domains ONLY.
  const progressDomains = new Set((await repos.plans.progress.list({})).map((p) => p.domain));
  assert.deepEqual(progressDomains, new Set(["overall", "health", "money", "habits", "skills"]));
  const snapshotDomains = new Set((await repos.plans.dayOneSnapshots.list({})).map((s) => s.domain));
  assert.deepEqual(snapshotDomains, new Set(["health", "money", "habits", "skills"]));
  assert.ok(!snapshotDomains.has("overall"), "day-one snapshots never include overall");
  // No unearned XP anywhere (no amber): every progress row is zeroed.
  assert.ok((await repos.plans.progress.list({})).every((p) => p.xp === 0 && p.level === 1 && p.streak === 0));

  // Money: categories + a budget (integer paise) for the budget-goal user.
  assert.ok((await repos.money.categories.list({})).length >= 2);
  const budgets = await repos.money.budgets.list({});
  assert.ok(budgets.length >= 1);
  assert.ok(budgets.every((b) => Number.isInteger(b.limitPaise)));

  // Habits + skills + ordered milestones.
  assert.ok((await repos.habits.habits.list({})).length >= 1);
  assert.equal((await repos.skills.skills.list({})).length, 1);
  const milestones = await repos.skills.milestones.list({});
  assert.equal(milestones.length, 3);
  assert.deepEqual(
    milestones.map((m) => m.sortOrder).sort((a, b) => a - b),
    [0, 1, 2],
  );

  // Gaps: the five DETAIL sections, all open (no un-selected domains here).
  const gaps = await repos.profile.gaps.list({});
  assert.equal(gaps.length, 5);
  assert.ok(gaps.every((g) => g.status === "open"));
  assert.deepEqual(
    new Set(gaps.map((g) => g.gapKey)),
    new Set(["detail-food", "detail-screen-time", "detail-focus", "detail-career", "detail-money"]),
  );

  // The deterministic Day-1 coach note (no gateway) is present.
  const notes = await repos.coach.notes.list({ scope: "daily" });
  const day1 = notes.find((n) => n.stalenessKey === "onboarding-day1");
  assert.ok(day1);
  assert.equal(day1?.text, "Day 1, Satvik. Small and consistent beats big and rare.");
  assert.equal(day1?.scope, "daily");
  assert.equal(result.coachNoteId, day1?.id);
});

test("F1 — accepting twice does NOT double-write (the profile-complete guard replays)", async () => {
  const { repos, service, llm } = await setup();
  const spines = await generateSpines(ALL_DOMAINS, llm);
  await service.accept({ answers: ALL_DOMAINS, spines, timezone: "UTC" });
  const afterFirst = await counts(repos);

  const replay = await service.accept({ answers: ALL_DOMAINS, spines, timezone: "UTC" });
  assert.equal(replay.status, "replayed");
  assert.equal(replay.profileCreated, false);
  assert.deepEqual(await counts(repos), afterFirst, "a second accept must add zero rows");
});

test("F1 — the 1-domain-only variant writes just that domain + gaps for the rest", async () => {
  const onlySkill: CoreAnswers = {
    ...ALL_DOMAINS,
    goals: { health: [], money: [], habits: [], skillName: "System design" },
  };
  const { repos, service, llm } = await setup();
  const spines = await generateSpines(onlySkill, llm);
  assert.equal(spines.length, 1);

  await service.accept({ answers: onlySkill, spines, timezone: "UTC" });

  assert.equal((await repos.plans.arcs.list({})).length, 1);
  assert.equal((await repos.skills.skills.list({})).length, 1);
  assert.equal((await repos.money.categories.list({})).length, 0);
  assert.equal((await repos.habits.habits.list({})).length, 0);

  const progressDomains = new Set((await repos.plans.progress.list({})).map((p) => p.domain));
  assert.deepEqual(progressDomains, new Set(["overall", "skills"]));
  const snapshotDomains = new Set((await repos.plans.dayOneSnapshots.list({})).map((s) => s.domain));
  assert.deepEqual(snapshotDomains, new Set(["skills"]));

  // Gaps: 5 DETAIL + one per UN-selected domain (health/money/habits), never goal-skills.
  const gapKeys = new Set((await repos.profile.gaps.list({})).map((g) => g.gapKey));
  assert.ok(gapKeys.has("goal-health") && gapKeys.has("goal-money") && gapKeys.has("goal-habits"));
  assert.ok(!gapKeys.has("goal-skills"));
  assert.equal(gapKeys.size, 8); // 5 detail + 3 unselected
});

test("F1 — a pre-existing named category is REUSED and the budget FK points at it", async () => {
  const { repos, service, llm } = await setup();
  // A dev DB that already carries the canonical "Food & dining" category (SAR-006 seed).
  const preExisting = await repos.money.categories.create({
    name: "Food & dining",
    kind: "expense",
    colorKey: "amber",
    isSystem: true,
  });

  const moneyOnly: CoreAnswers = {
    ...ALL_DOMAINS,
    goals: { health: [], money: ["budget"], habits: [], skillName: null },
  };
  const spines = await generateSpines(moneyOnly, llm);
  await service.accept({ answers: moneyOnly, spines, timezone: "UTC" });

  // No duplicate category — the pre-existing "Food & dining" was matched by (name, kind).
  const foodCategories = (await repos.money.categories.list({})).filter(
    (c) => c.name.toLowerCase() === "food & dining",
  );
  assert.equal(foodCategories.length, 1);
  assert.equal(foodCategories[0].id, preExisting.id);

  // The Food & dining budget's FK is wired to the PRE-EXISTING category, not a new row.
  const budgets = await repos.money.budgets.list({});
  const foodBudget = budgets.find((b) => b.categoryId === preExisting.id);
  assert.ok(foodBudget, "the budget must reference the pre-existing categoryId");
  assert.equal(foodBudget?.limitPaise, 800000);
});

/* ── SAR-012 Pass 2 review fixes (CF-1/CF-2/CF-4/CF-5/CF-8) ─────────────────── */

test("CF-1 — a second, separate service instance accepting the same payload replays", async () => {
  // Two service instances mimic two requests: each builds its own single-flight closure, so
  // the lock serialises nothing between them. The second must still see the complete profile
  // and return the replay no-op — never a duplicate write or a constraint 500.
  const { repos, service: svc1, llm } = await setup();
  const svc2 = createAcceptOnboardingService({ repos, now: () => NOW });
  const spines = await generateSpines(ALL_DOMAINS, llm);
  const payload = { answers: ALL_DOMAINS, spines, timezone: "UTC" };

  const first = await svc1.accept(payload);
  const second = await svc2.accept(payload);

  assert.equal(first.status, "accepted");
  assert.equal(second.status, "replayed", "a separate instance must detect the complete profile and replay");
  assert.equal(second.profileCreated, false);
  assert.equal((await repos.plans.arcs.list({})).length, 4, "no duplicate arcs from the second request");
  assert.equal((await repos.plans.items.list({})).length, first.created.items, "no duplicate items");
  assert.equal((await repos.profile.profiles.list({})).length, 1, "exactly one profile row");
});

test("CF-2 — duplicate names within one payload collapse to one row (no unique-index 500)", async () => {
  const { repos, service, llm } = await setup();
  const spines = await generateSpines(ALL_DOMAINS, llm);

  // The UI's "+ Add a habit" / "+ Add a category" tapped twice yields two IDENTICAL names —
  // which the case-sensitive unique index would reject as a duplicate → rollback → 500. A
  // third case-variant name additionally locks the case-fold collapse.
  const habitsSpine = spines.find((s) => s.domain === "habits");
  if (habitsSpine && habitsSpine.domain === "habits") {
    const dupHabit = {
      cadence: "daily" as const,
      difficulty: "medium",
      targetValue: null,
      targetUnit: null,
      satisfactionRule: null,
    };
    habitsSpine.habits.push(
      { name: "New habit", ...dupHabit },
      { name: "New habit", ...dupHabit },
      { name: "new HABIT", ...dupHabit },
    );
  }
  const moneySpine = spines.find((s) => s.domain === "money");
  if (moneySpine && moneySpine.domain === "money") {
    moneySpine.categories.push(
      { name: "New category", kind: "expense", monthlyLimitPaise: null },
      { name: "New category", kind: "expense", monthlyLimitPaise: null },
      { name: "NEW category", kind: "expense", monthlyLimitPaise: null },
    );
  }

  const result = await service.accept({ answers: ALL_DOMAINS, spines, timezone: "UTC" });
  assert.equal(result.status, "accepted", "duplicate names in one payload must not 500");

  const newHabits = (await repos.habits.habits.list({})).filter((h) => h.name.toLowerCase() === "new habit");
  assert.equal(newHabits.length, 1, "three identical/case-folded habit names collapse to one row");
  const newCats = (await repos.money.categories.list({})).filter((c) => c.name.toLowerCase() === "new category");
  assert.equal(newCats.length, 1, "three identical/case-folded category names collapse to one row");
});

test("CF-8 — new milestones start after the max existing sortOrder, not the count", async () => {
  const onlySkill: CoreAnswers = {
    ...ALL_DOMAINS,
    goals: { health: [], money: [], habits: [], skillName: "System design" },
  };
  const { repos, service, llm } = await setup();
  // A pre-existing skill with NON-CONTIGUOUS milestone sortOrders ([2,3]): the old
  // `existingMilestones.length` (=2) would reuse 2 and collide on the unique index → 500.
  const skill = await repos.skills.skills.create({ name: "System design", targetMinutes: 600, isArchived: false });
  await repos.skills.milestones.create({ skillId: skill.id, label: "Existing A", sortOrder: 2, completedAt: null });
  await repos.skills.milestones.create({ skillId: skill.id, label: "Existing B", sortOrder: 3, completedAt: null });

  const spines = await generateSpines(onlySkill, llm);
  await service.accept({ answers: onlySkill, spines, timezone: "UTC" }); // must not throw on the unique index

  const milestones = await repos.skills.milestones.list({ skillId: skill.id });
  const sortOrders = milestones.map((m) => m.sortOrder);
  assert.equal(new Set(sortOrders).size, sortOrders.length, "no two milestones share a sortOrder");
  assert.equal(milestones.length, 5, "the 3 derived milestones land after the 2 pre-existing ones");
});

test("CF-4/CF-5 — the schema rejects empty, duplicate-domain, and bad-timezone payloads", async () => {
  const { llm } = await setup();
  const spines = await generateSpines(ALL_DOMAINS, llm);

  const empty = acceptOnboardingInputSchema.safeParse({ answers: ALL_DOMAINS, spines: [], timezone: "UTC" });
  assert.equal(empty.success, false, "spines: [] must be rejected (no planless 'complete' profile)");

  const dupDomain = acceptOnboardingInputSchema.safeParse({
    answers: ALL_DOMAINS,
    spines: [spines[0], spines[0]],
    timezone: "UTC",
  });
  assert.equal(dupDomain.success, false, "two spines for the same domain must be rejected");

  const badZone = acceptOnboardingInputSchema.safeParse({ answers: ALL_DOMAINS, spines, timezone: "Mars/Olympus" });
  assert.equal(badZone.success, false, "a non-IANA timezone must be rejected at the boundary (no Intl 500)");

  const ok = acceptOnboardingInputSchema.safeParse({ answers: ALL_DOMAINS, spines, timezone: "Asia/Kolkata" });
  assert.equal(ok.success, true, "a well-formed payload with a real IANA zone still parses");
});
