/**
 * tests/commit.test.ts — CommitService.commit (SAR-004, D-D/D-F). Keyless.
 * Auto-batch writes exactly the typed rows; pending writes nothing; wrongSilentWrites
 * === 0; idempotent replay; accepted card; mid-dispatch rollback; coach-note isolation.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type { LlmGateway, UserScopedRepositories } from "../core/contracts";
import {
  createCommitService,
  prepareDraft,
  resolveProposal,
  type ResolvedProposal,
} from "../core/capture";
import { createRepositoryFactory } from "../data/repository";
import { canonicalFixture, explicitLowConfidenceFixture, undoBatchFixture } from "./fixtures/capture";
import { createMemoryDb } from "./helpers/memory-db";
import { createLlmGateway } from "../providers";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const NOW = "2026-07-17T05:20:00.000Z";
const canonical = canonicalFixture.draft!;

let savedFetch: typeof globalThis.fetch;
const savedKeys: Record<string, string | undefined> = {};
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("commit test must not hit the network");
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
  const service = createCommitService({ repos, llm, now: () => NOW });
  return { repos, service };
}

async function seedCanonical(repos: UserScopedRepositories) {
  await repos.money.categories.create({ name: "Food & dining", kind: "expense", colorKey: "amber", isSystem: false });
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
}

test("canonical auto-batch writes exactly the 2 typed rows + envelope + progress", async () => {
  const { repos, service } = await setup();
  await seedCanonical(repos);
  const { autoCommit } = await prepareDraft(canonical, repos);
  assert.equal(autoCommit.length, 2);

  const result = await service.commit({ idempotencyKey: "k1", kind: "capture", proposals: autoCommit });

  assert.equal(result.status, "committed");
  assert.equal(result.entries.length, 2);
  assert.equal(result.progressEffects.length, 2); // money + skills
  assert.ok(result.coachNoteId, "fake coach note should be written");

  const txns = await repos.money.transactions.list({});
  assert.equal(txns.length, 1);
  assert.equal(txns[0].amountPaise, 34000);
  assert.equal(txns[0].direction, "debit");
  assert.ok(txns[0].categoryId);

  const sessions = await repos.skills.sessions.list({});
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].minutes, 90);

  const progress = await repos.plans.progress.list({});
  assert.equal(progress.length, 2);
  assert.ok(progress.every((p) => p.xp > 0));

  const commits = await repos.commits.commits.list({});
  assert.equal(commits.length, 1);
  assert.equal(commits[0].status, "committed");
});

test("wrongSilentWrites === 0: pending estimates never reach a table", async () => {
  const { repos, service } = await setup();
  await seedCanonical(repos);
  const { autoCommit, pending } = await prepareDraft(canonical, repos);
  await service.commit({ idempotencyKey: "k1", kind: "capture", proposals: autoCommit });

  // The estimated meal + null-ml water were pending — they must not exist.
  assert.equal((await repos.health.meals.list({})).length, 0);
  assert.equal((await repos.health.waterLogs.list({})).length, 0);
  assert.equal((await repos.habits.logs.list({})).length, 0);
  // And nothing estimated slipped into the committed rows.
  const estimatedWrites = [...(await repos.money.transactions.list({})), ...(await repos.skills.sessions.list({}))].filter(
    (row) => row.estimated,
  );
  assert.equal(estimatedWrites.length, 0);
  assert.equal(pending.length, 3);
});

test("explicit-low-confidence never routes to the auto batch", async () => {
  const { repos } = await setup();
  const { autoCommit } = await prepareDraft(explicitLowConfidenceFixture.draft!, repos);
  assert.equal(autoCommit.length, 0);
});

test("idempotent replay: same key returns the original with zero new rows", async () => {
  const { repos, service } = await setup();
  await seedCanonical(repos);
  const { autoCommit } = await prepareDraft(canonical, repos);
  const first = await service.commit({ idempotencyKey: "k1", kind: "capture", proposals: autoCommit });
  const second = await service.commit({ idempotencyKey: "k1", kind: "capture", proposals: autoCommit });

  assert.equal(first.status, "committed");
  assert.equal(second.status, "replayed");
  assert.equal((await repos.money.transactions.list({})).length, 1); // not duplicated
  assert.equal((await repos.commits.commits.list({})).length, 1);
});

test("single-flight (D-F): two interleaved commits serialize with no executor corruption", async () => {
  const { repos, service } = await setup();
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  const { autoCommit } = await prepareDraft(undoBatchFixture.draft!, repos);

  // Fire both WITHOUT awaiting the first — withLock must serialize them so the
  // ScopeContext executor swap is never re-entered. If it were, one transaction would
  // throw or lose rows; instead both commit cleanly and the second supersedes the first.
  const p1 = service.commit({ idempotencyKey: "i1", kind: "capture", proposals: autoCommit });
  const p2 = service.commit({ idempotencyKey: "i2", kind: "capture", proposals: autoCommit });
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(r1.status, "committed");
  assert.equal(r2.status, "committed");
  assert.notEqual(r1.commitId, r2.commitId);

  assert.equal((await repos.skills.sessions.list({})).length, 2); // both wrote, none lost
  const commits = await repos.commits.commits.list({});
  assert.equal(commits.length, 2);
  assert.equal(commits.filter((c) => c.status === "committed").length, 1); // exactly one active
  assert.equal(commits.filter((c) => c.status === "superseded").length, 1); // the earlier one
});

test("an accepted meal card writes the meal + its items", async () => {
  const { repos, service } = await setup();
  const mealProposal = canonical.proposals.find((p) => p.kind === "meal")!;
  const outcome = await resolveProposal(mealProposal, repos, "accepted");
  assert.ok(outcome.ok);
  await service.commit({ idempotencyKey: "meal-1", kind: "tap", proposals: [outcome.resolved] });

  assert.equal((await repos.health.meals.list({})).length, 1);
  assert.equal((await repos.health.mealItems.list({})).length, 2);
});

test("a mid-dispatch failure rolls back the entire batch (no partial envelope/rows)", async () => {
  const { repos, service } = await setup();
  const habit = await repos.habits.habits.create({
    name: "Wake by 5:30 AM",
    cadence: "daily",
    difficulty: "medium",
    targetValue: null,
    targetUnit: null,
    isArchived: false,
  });
  // Two logs for the same habit + localDate violate the unique constraint on the second create.
  const dup = (proposalId: string): ResolvedProposal => ({
    proposalId,
    domain: "habits",
    kind: "habitLog",
    intent: "create",
    occurredAt: NOW,
    localDate: "2026-07-17",
    timezone: "Asia/Kolkata",
    estimated: false,
    confidenceBps: 9500,
    why: { basis: "x", assumptions: [] },
    evidenceRefs: [],
    status: "auto",
    payload: { habitId: habit.id, status: "done", note: null },
  });

  await assert.rejects(() =>
    service.commit({ idempotencyKey: "dup", kind: "capture", proposals: [dup("a"), dup("b")] }),
  );
  assert.equal((await repos.commits.commits.list({})).length, 0);
  assert.equal((await repos.habits.logs.list({})).length, 0);
});

test("a coach-note failure never rolls back a safe commit", async () => {
  const brokenCoach: LlmGateway = {
    async generateObject() {
      throw new Error("unused");
    },
    async generateText() {
      throw new Error("coach tier down");
    },
  };
  const { repos, service } = await setup(brokenCoach);
  await seedCanonical(repos);
  const { autoCommit } = await prepareDraft(canonical, repos);
  const result = await service.commit({ idempotencyKey: "k1", kind: "capture", proposals: autoCommit });

  assert.equal(result.status, "committed");
  assert.equal(result.coachNoteId, null);
  assert.equal((await repos.money.transactions.list({})).length, 1); // the safe commit stands
});
