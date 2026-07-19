/**
 * tests/transaction.test.ts — the repository transaction rail over a MIGRATED
 * in-memory db. Proves all-or-nothing batching: a resolved batch commits every
 * write; a throw inside the batch rolls the whole thing back. Fresh migrated db
 * per test so counts are deterministic. Keyless and network-free.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type {
  AuthenticatedUser,
  UserScopedRepositories,
} from "../core/contracts";

import { createMemoryDb } from "./helpers/memory-db";

const LOCAL: AuthenticatedUser = { userId: "local-dev", email: null, mode: "local" };

const savedFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (async () => {
    throw new Error("transaction rail must not call fetch");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

async function freshRepos(): Promise<UserScopedRepositories> {
  const { db } = await createMemoryDb();
  const { createRepositoryFactory } = await import("../data/repository");
  return createRepositoryFactory(db).forUser(LOCAL);
}

function skillInput(name: string) {
  // The typed port injects `userId` from the scope; callers never supply it.
  return { name, targetMinutes: null, isArchived: false };
}

test("a resolved transaction commits every write as one batch", async () => {
  const repos = await freshRepos();

  await repos.transaction(async () => {
    await repos.skills.skills.create(skillInput("Row A"));
    await repos.skills.skills.create(skillInput("Row B"));
  });

  const rows = await repos.skills.skills.list({});
  assert.equal(rows.length, 2, "both rows persisted after the batch resolved");
  const names = rows.map((row) => row.name).sort();
  assert.deepEqual(names, ["Row A", "Row B"]);
});

test("a throwing transaction rolls the whole batch back — all or nothing", async () => {
  const repos = await freshRepos();

  await assert.rejects(
    repos.transaction(async () => {
      await repos.skills.skills.create(skillInput("Row C"));
      throw new Error("boom");
    }),
    /boom/,
  );

  const rows = await repos.skills.skills.list({});
  assert.equal(rows.length, 0, "Row C was rolled back — no partial write survived");
  assert.ok(
    !rows.some((row) => row.name === "Row C"),
    "the rolled-back row is absent",
  );
});
