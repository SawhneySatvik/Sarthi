/**
 * tests/route.test.ts — routing (D-B) + resolution (D-C). Keyless, network-free.
 *
 * Pure routing is intrinsic to a proposal; resolution (name→id via the injected
 * repos) can further demote an auto proposal to pending. The canonical dump lands
 * exactly 2 auto / 3 pending once the user's category + skill are seeded; without
 * the seed the explicit creates demote (unknown category/skill — rule 7), never
 * inventing a row.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  applyUserEdit,
  blockedProposalIds,
  isAcceptAllEligible,
  prepareDraft,
  routeProposal,
} from "../core/capture";
import { createRepositoryFactory } from "../data/repository";
import {
  ambiguousSkillFixture,
  backdateHabitFixture,
  canonicalFixture,
  correctionExistingEntryFixture,
  explicitLowConfidenceFixture,
} from "./fixtures/capture";
import { createMemoryDb } from "./helpers/memory-db";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const canonical = canonicalFixture.draft!;

let savedFetch: typeof globalThis.fetch;
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("route test must not hit the network");
  }) as typeof globalThis.fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

async function freshRepos() {
  const { db } = await createMemoryDb();
  return createRepositoryFactory(db).forUser(LOCAL);
}

async function seededRepos() {
  const repos = await freshRepos();
  await repos.money.categories.create({ name: "Food & dining", kind: "expense", colorKey: "amber", isSystem: false });
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  return repos;
}

test("canonical: category + skill seeded → exactly 2 auto / 3 pending", async () => {
  const repos = await seededRepos();
  const prepared = await prepareDraft(canonical, repos);

  assert.deepEqual(
    prepared.autoCommit.map((p) => p.proposalId).sort(),
    [...canonicalFixture.expected.auto].sort(),
  );
  assert.deepEqual(
    prepared.pending.map((c) => c.proposal.proposalId).sort(),
    [...canonicalFixture.expected.pending].sort(),
  );
  // The resolved transaction carries a categoryId, never the raw name.
  const txn = prepared.autoCommit.find((p) => p.kind === "transaction");
  assert.ok(txn && txn.kind === "transaction");
  assert.equal(typeof txn.payload.categoryId, "string");
});

test("canonical: without the seed, explicit creates demote (unknown category/skill) → 0 auto", async () => {
  const repos = await freshRepos();
  const prepared = await prepareDraft(canonical, repos);
  assert.equal(prepared.autoCommit.length, 0);
  assert.equal(prepared.pending.length, 5); // nothing auto-files with an unresolved entity
});

test("ambiguous-skill: routes then demotes to pending — never invents a skill/session", async () => {
  const repos = await freshRepos();
  const prepared = await prepareDraft(ambiguousSkillFixture.draft!, repos);
  assert.equal(prepared.autoCommit.length, 0);
  assert.equal(prepared.pending.length, 1);
});

test("§5.1 rules (pure): estimated / low-confidence / null-quantity / correction / backdate all route pending", () => {
  const none = new Set<string>();
  assert.equal(routeProposal(explicitLowConfidenceFixture.draft!.proposals[0], none).route, "pending");
  const meal = canonical.proposals.find((p) => p.kind === "meal")!;
  assert.equal(routeProposal(meal, none).route, "pending"); // estimated
  const water = canonical.proposals.find((p) => p.kind === "water")!;
  assert.equal(routeProposal(water, none).route, "pending"); // null millilitres + estimated
  assert.equal(routeProposal(correctionExistingEntryFixture.draft!.proposals[0], none).route, "pending");
  assert.equal(routeProposal(backdateHabitFixture.draft!.proposals[0], none).route, "pending");
});

test("§5.1 rule 7: a question-blocked proposal routes pending", () => {
  const draft = ambiguousSkillFixture.draft!;
  assert.equal(routeProposal(draft.proposals[0], blockedProposalIds(draft)).route, "pending");
});

test("positive: an explicit, high-confidence, complete create routes auto (intrinsic)", () => {
  const txn = canonical.proposals.find((p) => p.kind === "transaction")!;
  assert.equal(routeProposal(txn, new Set()).route, "auto");
});

test("applyUserEdit resets estimated/confidence and stamps 'user edit' (rule 5)", () => {
  const meal = canonical.proposals.find((p) => p.kind === "meal")!;
  const edited = applyUserEdit(meal, { kcal: 600 });
  assert.equal(edited.estimated, false);
  assert.equal(edited.confidenceBps, 10000);
  assert.equal(edited.why.basis, "user edit");
});

test("isAcceptAllEligible: all pending ≥8000 & unblocked → true; one below → false (rule 6)", () => {
  const habit = canonical.proposals.find((p) => p.kind === "habitLog")!; // 8600
  const water = canonical.proposals.find((p) => p.kind === "water")!; // 6000
  assert.equal(isAcceptAllEligible([habit], new Set()), true);
  assert.equal(isAcceptAllEligible([habit, water], new Set()), false);
});
