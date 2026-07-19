/**
 * tests/onboarding-detail.test.ts — SAR-012 Pass 3 (Phase E DETAIL · Phase F theme · D-G seed).
 *
 * The DETAIL flow runs AFTER the D-accept: the profile is `complete` and the five `profile_gaps`
 * already exist (accept enqueued them). These prove that answering a section (a) patches the
 * owning profile column with integers/paise, (b) marks that section's gap `answered`, and
 * (c) leaves un-answered sections `open` (the SAR-014 backfill queue) — never creating a gap.
 * E5 seeds integer-paise `recurring_rules`, replay-safe. Plus `seedDemo` idempotency (D-033).
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type { UserScopedRepositories } from "../core/contracts";
import {
  applyOnboardingDetail,
  createAcceptOnboardingService,
  DETAIL_GAP_KEY,
  generateSpine,
  onboardingDetailInputSchema,
  selectedSpineDomains,
  type CoreAnswers,
  type DomainSpine,
} from "../core/onboarding";
import { createRepositoryFactory } from "../data/repository";
import { seedDemo } from "../data/seed/demo";
import { createLlmGateway } from "../providers";
import { createMemoryDb } from "./helpers/memory-db";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const NOW = "2026-07-18T05:20:00.000Z";

const ANSWERS: CoreAnswers = {
  displayName: "Satvik",
  birthDate: "1998-03-14",
  heightCm: 178,
  weightGrams: 74000,
  unitSystem: "metric",
  dayShape: "nine_to_five",
  wakeTimeMinutes: 330,
  sleepTimeMinutes: 1380,
  goals: {
    health: ["gym"],
    money: ["budget"],
    habits: ["focus"],
    skillName: "System design",
  },
  timeBudgetMinutes: 30,
};

const MONEY_INPUT = {
  section: "money" as const,
  monthlyIncomePaise: 12_000_000,
  bills: [
    { label: "Rent", amountPaise: 2_500_000 },
    { label: "Internet", amountPaise: 99_900 },
  ],
};

let savedFetch: typeof globalThis.fetch;
const savedKeys: Record<string, string | undefined> = {};
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("onboarding-detail test must not hit the network");
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

/** A fresh scope that has been carried through the D-accept (profile complete, 5 gaps open). */
async function acceptedScope(): Promise<UserScopedRepositories> {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const llm = createLlmGateway("fake");
  const spines: DomainSpine[] = [];
  for (const domain of selectedSpineDomains(ANSWERS)) {
    const result = await generateSpine({ domain, answers: ANSWERS }, llm);
    assert.ok(result.ok, `generateSpine ${domain} should succeed on the fake`);
    if (result.ok) spines.push(result.spine);
  }
  const accept = createAcceptOnboardingService({ repos, now: () => NOW });
  await accept.accept({ answers: ANSWERS, spines, timezone: "UTC" });
  return repos;
}

async function gapByKey(repos: UserScopedRepositories, gapKey: string) {
  return (await repos.profile.gaps.list({ gapKey }))[0] ?? null;
}

test("accept enqueues exactly the gap keys the DETAIL sections resolve", async () => {
  const repos = await acceptedScope();
  const gapKeys = new Set((await repos.profile.gaps.list({})).map((g) => g.gapKey));
  for (const key of Object.values(DETAIL_GAP_KEY)) {
    assert.ok(gapKeys.has(key), `accept must enqueue the '${key}' gap the detail flow answers`);
  }
});

test("E1–E4 patch their profile column, mark the gap answered, and leave others open", async () => {
  const repos = await acceptedScope();

  await applyOnboardingDetail({ section: "food", diet: "non_veg", cooking: "order" }, repos, () => NOW);
  await applyOnboardingDetail({ section: "screen", screenTimeMinutes: 300 }, repos, () => NOW);
  await applyOnboardingDetail({ section: "focus", focus: "distractible" }, repos, () => NOW);
  await applyOnboardingDetail(
    { section: "career", field: "swe", fieldOther: null, skillLevel: "solid" },
    repos,
    () => NOW,
  );

  const profile = (await repos.profile.profiles.list({}))[0];
  assert.equal(profile.foodPattern, "non_veg/order");
  assert.equal(profile.screenTimeMinutes, 300);
  assert.ok(Number.isInteger(profile.screenTimeMinutes), "screen time is stored as integer minutes");
  assert.equal(profile.focusPreference, "distractible");
  assert.ok((profile.careerGoal ?? "").startsWith("swe"), "career column carries the field");

  // The four answered gaps are resolved; the un-answered money gap stays OPEN for SAR-014.
  for (const section of ["food", "screen", "focus", "career"] as const) {
    const gap = await gapByKey(repos, DETAIL_GAP_KEY[section]);
    assert.equal(gap?.status, "answered", `${section} gap answered`);
    assert.ok(gap?.answeredAt, `${section} gap carries answeredAt`);
  }
  const moneyGap = await gapByKey(repos, DETAIL_GAP_KEY.money);
  assert.equal(moneyGap?.status, "open", "a skipped section's gap stays open");

  // No gap was created — the count is exactly what accept enqueued.
  assert.equal((await repos.profile.gaps.list({})).length, 5);
});

test("E5 seeds integer-paise recurring rules (+ income category) and resolves its gap", async () => {
  const repos = await acceptedScope();
  const before = (await repos.money.recurringRules.list({})).length;

  const result = await applyOnboardingDetail(MONEY_INPUT, repos, () => NOW);
  assert.equal(result.recurringRulesCreated, 3, "one income credit + two bill debits");

  const rules = await repos.money.recurringRules.list({});
  assert.equal(rules.length, before + 3);
  assert.ok(rules.every((r) => Number.isInteger(r.amountPaise)), "every rule amount is integer paise");
  const income = rules.find((r) => r.direction === "credit" && r.amountPaise === 12_000_000);
  assert.ok(income, "the income credit rule exists");
  assert.ok(rules.some((r) => r.direction === "debit" && r.merchant === "Rent" && r.amountPaise === 2_500_000));

  const incomeCats = await repos.money.categories.list({ kind: "income" });
  assert.ok(incomeCats.some((c) => c.name.toLowerCase() === "income"), "an income category was created");

  assert.equal((await gapByKey(repos, DETAIL_GAP_KEY.money))?.status, "answered");
});

test("E5 is replay-safe — a second submit does not double-seed the rules", async () => {
  const repos = await acceptedScope();
  await applyOnboardingDetail(MONEY_INPUT, repos, () => NOW);
  const afterFirst = (await repos.money.recurringRules.list({})).length;

  const second = await applyOnboardingDetail(MONEY_INPUT, repos, () => NOW);
  assert.equal(second.recurringRulesCreated, 0, "the answered-gap guard skips the non-idempotent create");
  assert.equal((await repos.money.recurringRules.list({})).length, afterFirst);
});

test("theme patches theme/themeMode and resolves NO gap (there is none)", async () => {
  const repos = await acceptedScope();
  await applyOnboardingDetail({ section: "theme", theme: "moss", themeMode: "light" }, repos, () => NOW);

  const profile = (await repos.profile.profiles.list({}))[0];
  assert.equal(profile.theme, "moss");
  assert.equal(profile.themeMode, "light");
  // The theme step touches no gap — the queue is still exactly the five accept enqueued.
  assert.equal((await repos.profile.gaps.list({})).length, 5);
});

test("a float money amount dies at the zod boundary (integer paise only)", () => {
  const bad = onboardingDetailInputSchema.safeParse({ section: "money", monthlyIncomePaise: 100.5, bills: [] });
  assert.equal(bad.success, false, "a fractional paise value must be rejected");
  const floatMinutes = onboardingDetailInputSchema.safeParse({ section: "screen", screenTimeMinutes: 90.5 });
  assert.equal(floatMinutes.success, false, "fractional minutes must be rejected");
});

test("seedDemo — a second run is a no-op (the seed_runs ledger makes the gesture idempotent)", async () => {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);

  const first = await seedDemo(repos);
  assert.equal(first.seeded, true);
  const snapshot = async () => ({
    arcs: (await repos.plans.arcs.list({})).length,
    categories: (await repos.money.categories.list({})).length,
    recurringRules: (await repos.money.recurringRules.list({})).length,
    skills: (await repos.skills.skills.list({})).length,
    sessions: (await repos.skills.sessions.list({})).length,
  });
  const afterFirst = await snapshot();

  const second = await seedDemo(repos);
  assert.equal(second.seeded, false, "the seed_runs guard short-circuits the replay");
  assert.deepEqual(await snapshot(), afterFirst, "a second run duplicates nothing");

  assert.equal((await repos.profile.seedRuns.list({})).length, 1, "exactly one ledger row");
  const profile = (await repos.profile.profiles.list({}))[0];
  assert.equal(profile.onboardingStatus, "complete", "the demo lands a complete profile");
});
