/**
 * tests/repository.test.ts — the repository layer over a MIGRATED in-memory db.
 *
 * The factory is built over `createMemoryDb()`'s migrated handle (NOT
 * `createSqliteRepositoryFactory(":memory:")`, which would open a fresh empty db
 * with no tables). Every test proves the tenant mechanism: `userId` comes only
 * from the scope, never from caller input. Keyless and network-free — fetch is
 * overridden to throw for the whole file.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type {
  AuthenticatedUser,
  RepositoryFactory,
  UserScopedRepositories,
} from "../core/contracts";
import { RepositoryError } from "../core/contracts";
import type { SkillCreate, SkillQuery } from "../data/schema/contract";

import { createMemoryDb } from "./helpers/memory-db";

const LOCAL: AuthenticatedUser = { userId: "local-dev", email: null, mode: "local" };
const USER_B: AuthenticatedUser = { userId: "user-b", email: null, mode: "local" };

// No repository call may touch the network.
const savedFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (async () => {
    throw new Error("repository layer must not call fetch");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

/** Fresh migrated db + factory per test so row counts are deterministic. */
async function freshFactory(): Promise<RepositoryFactory> {
  const { db } = await createMemoryDb();
  const { createRepositoryFactory } = await import("../data/repository");
  return createRepositoryFactory(db);
}

async function freshRepos(user: AuthenticatedUser = LOCAL): Promise<UserScopedRepositories> {
  return (await freshFactory()).forUser(user);
}

test("CRUD auto-scopes to the ctx userId and honours the soft-delete filter", async () => {
  const repos = await freshRepos();
  const skills = repos.skills.skills;

  const created = await skills.create({
    name: "System Design",
    targetMinutes: 5400,
    isArchived: false,
  });
  assert.equal(created.userId, "local-dev", "row is stamped with the scope userId");
  assert.equal(typeof created.id, "string");
  assert.ok(created.id.length > 0, "create generates an id");
  assert.equal(created.deletedAt, null);

  const fetched = await skills.byId(created.id);
  assert.ok(fetched, "byId returns the created row");
  assert.equal(fetched.id, created.id);

  const listed = await skills.list({});
  assert.ok(
    listed.some((row) => row.id === created.id),
    "list includes the created row",
  );

  const updated = await skills.update(created.id, { targetMinutes: 3600 });
  assert.equal(updated.targetMinutes, 3600, "update changes the patched field");
  assert.equal(updated.id, created.id, "update keeps identity");
  assert.equal(updated.userId, "local-dev", "update never re-tenants the row");

  await skills.softDelete(created.id);
  assert.equal(await skills.byId(created.id), null, "byId drops soft-deleted rows");
  const afterDelete = await skills.list({});
  assert.ok(
    !afterDelete.some((row) => row.id === created.id),
    "list drops soft-deleted rows",
  );
});

test("a caller-supplied userId on create is ignored — scope always wins", async () => {
  const repos = await freshRepos();
  // The typed port `Omit`s `userId` off the input, so a caller cannot pass it
  // through the front door. Force a *foreign* tenant id in anyway (cast past the
  // port type) to prove the impl still overrides it from ctx.
  const created = await repos.skills.skills.create({
    userId: "user-b",
    name: "Impersonation Attempt",
    targetMinutes: null,
    isArchived: false,
  } as unknown as Omit<SkillCreate, "userId">);
  assert.equal(created.userId, "local-dev", "persisted row keeps the scope userId");

  // The list query also cannot filter to another tenant: userId is ctx-only.
  const spoofed = await repos.skills.skills.list(
    { userId: "user-b" } as unknown as Omit<SkillQuery, "userId">,
  );
  assert.ok(
    spoofed.some((row) => row.id === created.id),
    "list ignores the query userId and returns the scope's own rows",
  );
});

test("cross-scope isolation: tenants cannot see or address each other's rows", async () => {
  const factory = await freshFactory();
  const local = factory.forUser(LOCAL);
  const userB = factory.forUser(USER_B);

  const localSkill = await local.skills.skills.create({
    name: "Local Only",
    targetMinutes: null,
    isArchived: false,
  });
  const bSkill = await userB.skills.skills.create({
    name: "B Only",
    targetMinutes: null,
    isArchived: false,
  });

  const bList = await userB.skills.skills.list({});
  assert.ok(
    !bList.some((row) => row.id === localSkill.id),
    "user-b's list does not see local-dev's row",
  );
  assert.ok(bList.some((row) => row.id === bSkill.id), "user-b sees its own row");

  assert.equal(
    await local.skills.skills.byId(bSkill.id),
    null,
    "local-dev cannot byId a row owned by user-b",
  );
  assert.ok(
    await userB.skills.skills.byId(bSkill.id),
    "user-b can byId its own row",
  );
});

test("append-only repositories expose only create/byId/list", async () => {
  const repos = await freshRepos();
  const commits = repos.commits.commits;

  const created = await commits.create({
    draftId: null,
    idempotencyKey: "idem-1",
    kind: "capture",
    status: "committed",
    undoExpiresAt: "2026-07-17T00:10:00.000Z",
    undoneAt: null,
    summary: "one capture batch",
  });
  assert.equal(created.userId, "local-dev");
  assert.ok(created.id.length > 0);

  const fetched = await commits.byId(created.id);
  assert.ok(fetched);
  assert.equal(fetched.idempotencyKey, "idem-1");

  const listed = await commits.list({});
  assert.ok(listed.some((row) => row.id === created.id));

  // The append-only port carries no mutation methods.
  const surface = commits as unknown as Record<string, unknown>;
  assert.equal(surface.update, undefined, "append-only exposes no update");
  assert.equal(surface.softDelete, undefined, "append-only exposes no softDelete");
});

test("profiles softDelete is refused — the singleton has no deletedAt column", async () => {
  const repos = await freshRepos();
  await assert.rejects(
    repos.profile.profiles.softDelete("local-dev"),
    RepositoryError,
  );
});
