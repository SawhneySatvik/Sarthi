/**
 * tests/undo.test.ts — undoLatest + correction/backdate (SAR-004, D-H). Keyless.
 * Atomic reversal of rows + XP; refuses expired/superseded/non-latest/double-undo;
 * correction updates in place (no dup) and undo restores the before snapshot;
 * backdate writes the historical date.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  UndoNotAvailableError,
  createCommitService,
  prepareDraft,
  resolveProposal,
  type ResolvedProposal,
} from "../core/capture";
import { createRepositoryFactory } from "../data/repository";
import { backdateHabitFixture, canonicalFixture, undoBatchFixture } from "./fixtures/capture";
import { createMemoryDb } from "./helpers/memory-db";
import { createLlmGateway } from "../providers";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const NOW = "2026-07-17T05:20:00.000Z";
const WITHIN = "2026-07-17T05:22:00.000Z"; // < NOW + 5min
const EXPIRED = "2026-07-17T05:30:00.000Z"; // > NOW + 5min
const canonical = canonicalFixture.draft!;

let savedFetch: typeof globalThis.fetch;
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("undo test must not hit the network");
  }) as typeof globalThis.fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

async function setup() {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const service = createCommitService({ repos, llm: createLlmGateway("fake"), now: () => NOW });
  return { repos, service };
}

test("undo-batch: rows soft-deleted, XP restored, commit marked undone — atomically", async () => {
  const { repos, service } = await setup();
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  const { autoCommit } = await prepareDraft(undoBatchFixture.draft!, repos);
  const committed = await service.commit({ idempotencyKey: "u1", kind: "capture", proposals: autoCommit });

  assert.equal((await repos.skills.sessions.list({})).length, 1);
  const before = (await repos.plans.progress.list({})).find((p) => p.domain === "skills");
  assert.ok(before && before.xp > 0);

  await service.undoLatest({ commitId: committed.commitId, now: WITHIN });

  assert.equal((await repos.skills.sessions.list({})).length, 0); // soft-deleted
  const restored = (await repos.plans.progress.list({})).find((p) => p.domain === "skills");
  assert.equal(restored?.xp, 0); // restored exactly from the snapshot
  assert.equal(restored?.streak, 0);
  assert.equal((await repos.commits.commits.byId(committed.commitId))?.status, "undone");
});

test("undo refuses an expired window", async () => {
  const { repos, service } = await setup();
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  const { autoCommit } = await prepareDraft(undoBatchFixture.draft!, repos);
  const committed = await service.commit({ idempotencyKey: "u1", kind: "capture", proposals: autoCommit });
  await assert.rejects(() => service.undoLatest({ commitId: committed.commitId, now: EXPIRED }), UndoNotAvailableError);
});

test("undo refuses a superseded batch (a newer commit supersedes it)", async () => {
  const { repos, service } = await setup();
  await repos.money.categories.create({ name: "Food & dining", kind: "expense", colorKey: "amber", isSystem: false });
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  const { autoCommit } = await prepareDraft(canonical, repos);
  const first = await service.commit({ idempotencyKey: "a", kind: "capture", proposals: autoCommit });
  await service.commit({ idempotencyKey: "b", kind: "capture", proposals: autoCommit.slice(0, 1) });

  await assert.rejects(() => service.undoLatest({ commitId: first.commitId, now: WITHIN }), UndoNotAvailableError);
});

test("undo refuses a double-undo", async () => {
  const { repos, service } = await setup();
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  const { autoCommit } = await prepareDraft(undoBatchFixture.draft!, repos);
  const committed = await service.commit({ idempotencyKey: "u1", kind: "capture", proposals: autoCommit });
  await service.undoLatest({ commitId: committed.commitId, now: WITHIN });
  await assert.rejects(() => service.undoLatest({ commitId: committed.commitId, now: WITHIN }), UndoNotAvailableError);
});

test("correction updates the matched entry in place; undo restores the before snapshot", async () => {
  const { repos, service } = await setup();
  const mealProposal = canonical.proposals.find((p) => p.kind === "meal")!;
  const created = await resolveProposal(mealProposal, repos, "accepted");
  assert.ok(created.ok);
  await service.commit({ idempotencyKey: "m1", kind: "tap", proposals: [created.resolved] });
  const meal = (await repos.health.meals.list({}))[0];
  const originalKcal = meal.kcal;

  const correction: ResolvedProposal = {
    proposalId: "corr-1",
    domain: "health",
    kind: "meal",
    intent: "correction",
    occurredAt: NOW,
    localDate: "2026-07-17",
    timezone: "Asia/Kolkata",
    estimated: false,
    confidenceBps: 10000,
    why: { basis: "user edit", assumptions: [] },
    evidenceRefs: [],
    matchedEntryId: meal.id,
    status: "accepted",
    payload: { kcal: 600, proteinGrams: 20, carbsGrams: 90, fatGrams: 16, items: [], note: "corrected" },
  };
  const corrected = await service.commit({ idempotencyKey: "m2", kind: "edit", proposals: [correction] });

  const meals = await repos.health.meals.list({});
  assert.equal(meals.length, 1); // updated in place, no duplicate
  assert.equal(meals[0].kcal, 600);

  await service.undoLatest({ commitId: corrected.commitId, now: WITHIN });
  assert.equal((await repos.health.meals.byId(meal.id))?.kcal, originalKcal);
});

test("backdate writes the historical date; undo removes it", async () => {
  const { repos, service } = await setup();
  await repos.habits.habits.create({
    name: "Gym",
    cadence: "daily",
    difficulty: "medium",
    targetValue: null,
    targetUnit: null,
    isArchived: false,
  });
  const resolved = await resolveProposal(backdateHabitFixture.draft!.proposals[0], repos, "accepted");
  assert.ok(resolved.ok);
  const committed = await service.commit({ idempotencyKey: "bd1", kind: "tap", proposals: [resolved.resolved] });

  const logs = await repos.habits.logs.list({});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].localDate, "2026-07-16");
  assert.equal(logs[0].status, "skipped");
  // Grace-aware recompute over the domain's logs (D-G/D-H): one log ⇒ streak 1.
  const progress = (await repos.plans.progress.list({})).find((p) => p.domain === "habits");
  assert.equal(progress?.streak, 1);
  assert.equal(progress?.lastActiveDate, "2026-07-16");

  await service.undoLatest({ commitId: committed.commitId, now: WITHIN });
  assert.equal((await repos.habits.logs.list({})).length, 0);
});

test("backdate with prior activity: streak recomputes grace-aware and lastActiveDate never regresses", async () => {
  const { repos, service } = await setup();
  const habit = await repos.habits.habits.create({
    name: "Gym",
    cadence: "daily",
    difficulty: "medium",
    targetValue: null,
    targetUnit: null,
    isArchived: false,
  });

  // A forward log for today → streak 1, lastActiveDate 2026-07-17 (incremental path).
  const forward: ResolvedProposal = {
    proposalId: "fwd-gym",
    domain: "habits",
    kind: "habitLog",
    intent: "create",
    occurredAt: NOW,
    localDate: "2026-07-17",
    timezone: "Asia/Kolkata",
    estimated: false,
    confidenceBps: 10000,
    why: { basis: "explicit", assumptions: [] },
    evidenceRefs: [],
    status: "accepted",
    payload: { habitId: habit.id, status: "done", note: null },
  };
  await service.commit({ idempotencyKey: "fwd", kind: "capture", proposals: [forward] });
  const afterForward = (await repos.plans.progress.list({})).find((p) => p.domain === "habits");
  assert.equal(afterForward?.streak, 1);
  assert.equal(afterForward?.lastActiveDate, "2026-07-17");

  // Accept a backdate for yesterday. The buggy incremental form regressed lastActiveDate
  // to 2026-07-16 (→ later streak inflation); the grace-aware recompute over {07-16, 07-17}
  // gives streak 2 and holds lastActiveDate at the latest activity, 2026-07-17.
  const backdate = await resolveProposal(backdateHabitFixture.draft!.proposals[0], repos, "accepted");
  assert.ok(backdate.ok);
  await service.commit({ idempotencyKey: "bd", kind: "tap", proposals: [backdate.resolved] });

  const afterBackdate = (await repos.plans.progress.list({})).find((p) => p.domain === "habits");
  assert.equal(afterBackdate?.streak, 2); // two consecutive days, grace-aware — no inflation
  assert.equal(afterBackdate?.lastActiveDate, "2026-07-17"); // never regresses below the prior latest
});

test("plan + satisfied-by effects fire on commit and undo reverses both", async () => {
  const { repos, service } = await setup();
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  const arc = await repos.plans.arcs.create({
    domain: "skills",
    mode: "build",
    title: "Skill arc",
    startDate: "2026-07-17",
    endDate: null,
    dayNumber: 1,
    status: "active",
  });
  const item = await repos.plans.items.create({
    arcId: arc.id,
    domain: "skills",
    kind: "target",
    title: "Study 30m",
    dueAt: null,
    localDate: "2026-07-17",
    targetValue: 30,
    targetUnit: "minutes",
    status: "active",
    completionSource: null,
    ruleJson: null,
    linkedHabitId: null,
    linkedSkillId: null,
  });
  const habit = await repos.habits.habits.create({
    name: "Deep work",
    cadence: "daily",
    difficulty: "medium",
    targetValue: null,
    targetUnit: null,
    isArchived: false,
  });
  await repos.habits.satisfactionRules.create({
    habitId: habit.id,
    sourceDomain: "skills",
    sourceKind: "skillSession",
    aggregateField: "minutes",
    minimumValue: 30,
    unit: "minutes",
  });

  const { autoCommit } = await prepareDraft(undoBatchFixture.draft!, repos); // 60-min "System design" session
  const committed = await service.commit({ idempotencyKey: "pse", kind: "capture", proposals: autoCommit });

  assert.equal((await repos.plans.items.byId(item.id))?.status, "done");
  const logs = await repos.habits.logs.list({});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].source, "satisfied-by"); // auto-completed by the rule (60 ≥ 30)

  await service.undoLatest({ commitId: committed.commitId, now: WITHIN });
  assert.equal((await repos.plans.items.byId(item.id))?.status, "active"); // plan item restored
  assert.equal((await repos.habits.logs.list({})).length, 0); // satisfied-by log removed
});
