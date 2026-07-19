/**
 * tests/commit-state.test.ts — D-E / NB-4: the two guarded commit-envelope
 * transitions (`markUndone`/`markSuperseded`). Keyless, network-free.
 *
 * Proves the state machine: both transition only from `status:'committed'`; they
 * mutate only `status` (+ `undoneAt`); a wrong from-state, foreign id, or absent
 * id throws `RepositoryError`; and the append-only envelope payload is untouched.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { RepositoryError } from "../core/contracts/errors";
import type { CommitCreate } from "../data/schema/contract";
import { createRepositoryFactory } from "../data/repository";
import { createMemoryDb } from "./helpers/memory-db";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const USER_B = { userId: "user-b", email: null, mode: "supabase" as const };

let savedFetch: typeof globalThis.fetch;
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("commit-state test must not hit the network");
  }) as typeof globalThis.fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

function commitInput(over: Partial<Omit<CommitCreate, "userId">> = {}): Omit<CommitCreate, "userId"> {
  return {
    draftId: null,
    idempotencyKey: "idem-1",
    kind: "capture",
    status: "committed",
    undoExpiresAt: "2026-07-17T00:05:00.000Z",
    undoneAt: null,
    summary: "test batch",
    ...over,
  };
}

async function scoped(user: typeof LOCAL | typeof USER_B) {
  const { db } = await createMemoryDb();
  return { db, repos: createRepositoryFactory(db).forUser(user) };
}

test("markUndone: committed → undone, sets undoneAt, leaves the payload intact", async () => {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const created = await repos.commits.commits.create(commitInput());

  const undone = await repos.commits.markUndone(created.id, "2026-07-17T00:01:00.000Z");

  assert.equal(undone.status, "undone");
  assert.equal(undone.undoneAt, "2026-07-17T00:01:00.000Z");
  // Only status/undoneAt move — the business payload is immutable.
  assert.equal(undone.id, created.id);
  assert.equal(undone.userId, "local-dev");
  assert.equal(undone.idempotencyKey, created.idempotencyKey);
  assert.equal(undone.kind, created.kind);
  assert.equal(undone.summary, created.summary);
  assert.equal(undone.undoExpiresAt, created.undoExpiresAt);
  assert.equal(undone.draftId, created.draftId);
  assert.equal(undone.createdAt, created.createdAt);
});

test("markSuperseded: committed → superseded, does not touch undoneAt", async () => {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const created = await repos.commits.commits.create(commitInput());

  const superseded = await repos.commits.markSuperseded(created.id);

  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.undoneAt, null);
});

test("a transition is only valid from 'committed' (no double-undo, no undo-after-supersede)", async () => {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);

  const a = await repos.commits.commits.create(commitInput({ idempotencyKey: "a" }));
  await repos.commits.markUndone(a.id, "2026-07-17T00:01:00.000Z");
  await assert.rejects(
    () => repos.commits.markUndone(a.id, "2026-07-17T00:02:00.000Z"),
    RepositoryError,
  );

  const b = await repos.commits.commits.create(commitInput({ idempotencyKey: "b" }));
  await repos.commits.markSuperseded(b.id);
  await assert.rejects(
    () => repos.commits.markUndone(b.id, "2026-07-17T00:03:00.000Z"),
    RepositoryError,
  );
});

test("transitions refuse a foreign/absent commit id", async () => {
  const { repos } = await scoped(LOCAL);
  await assert.rejects(
    () => repos.commits.markUndone("does-not-exist", "2026-07-17T00:01:00.000Z"),
    RepositoryError,
  );
  await assert.rejects(() => repos.commits.markSuperseded("does-not-exist"), RepositoryError);
});

test("cross-tenant: another user cannot transition the commit, and it stays committed", async () => {
  const { db } = await createMemoryDb();
  const factory = createRepositoryFactory(db);
  const local = factory.forUser(LOCAL);
  const other = factory.forUser(USER_B);

  const created = await local.commits.commits.create(commitInput());

  await assert.rejects(
    () => other.commits.markUndone(created.id, "2026-07-17T00:01:00.000Z"),
    RepositoryError,
  );
  const still = await local.commits.commits.byId(created.id);
  assert.equal(still?.status, "committed");
});
