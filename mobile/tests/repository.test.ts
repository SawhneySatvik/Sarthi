import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUser, UserScopedRepositories } from "@contracts";
import { buildHealthView } from "@core/domains/health";
import { applyNativeMigrations } from "../src/db/migrations";
import { InMemoryLocalRepositoryStorage } from "../src/db/memory";
import { MobileRepositoryFactory } from "../src/adapters/repository/factory";

const alice: AuthenticatedUser = { userId: "user-alice", email: "alice@example.test", mode: "local" };
const bob: AuthenticatedUser = { userId: "user-bob", email: "bob@example.test", mode: "local" };

function waterInput(millilitres = 900) {
  return {
    occurredAt: "2026-07-21T05:10:00.000Z",
    localDate: "2026-07-21",
    timezone: "Asia/Kolkata",
    millilitres,
    source: "capture",
    confidenceBps: 10000,
    estimated: false,
  } as const;
}

function commitInput(idempotencyKey: string) {
  return {
    idempotencyKey,
    draftId: "draft-1",
    kind: "capture" as const,
    status: "committed" as const,
    undoExpiresAt: "2026-07-21T05:15:00.000Z",
    undoneAt: null,
    summary: "1 entry via capture",
  };
}

function scoped(storage: InMemoryLocalRepositoryStorage, user = alice): UserScopedRepositories {
  return new MobileRepositoryFactory(storage).forUser(user);
}

test("typed Health writes feed the shared Health projection and notify a scoped version", async () => {
  const storage = new InMemoryLocalRepositoryStorage();
  const factory = new MobileRepositoryFactory(storage);
  const repos = factory.forUser(alice);
  const received: number[] = [];
  factory.changes.subscribe((change) => {
    if (change.userId === alice.userId) received.push(change.version);
  });

  const water = await repos.health.waterLogs.create(waterInput(1250));
  assert.equal(water.userId, alice.userId);
  assert.equal(water.millilitres, 1250);
  assert.equal(water.estimated, false);

  const waterLogs = await repos.health.waterLogs.list({ localDate: "2026-07-21" });
  const health = buildHealthView({ meals: [], waterLogs, workouts: [], weighIns: [] });
  assert.equal(health.rings.find((ring) => ring.key === "water")?.value, 1250);
  assert.deepEqual(received, [1]);
  assert.equal(await factory.changes.versionFor(alice.userId), 1);
});

test("a new factory over the same durable-storage abstraction sees prior typed rows", async () => {
  const storage = new InMemoryLocalRepositoryStorage();
  await scoped(storage).health.waterLogs.create(waterInput(700));

  const afterRestart = scoped(storage);
  const rows = await afterRestart.health.waterLogs.list({});
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.millilitres, 700);
});

test("all reads and mutations are bound to the authenticated user scope", async () => {
  const storage = new InMemoryLocalRepositoryStorage();
  const aliceRepos = scoped(storage, alice);
  const bobRepos = scoped(storage, bob);
  const water = await aliceRepos.health.waterLogs.create(waterInput());

  assert.deepEqual(await bobRepos.health.waterLogs.list({}), []);
  assert.equal(await bobRepos.health.waterLogs.byId(water.id), null);
  await assert.rejects(() => bobRepos.health.waterLogs.update(water.id, { millilitres: 42 }));
  assert.equal((await aliceRepos.health.waterLogs.byId(water.id))?.millilitres, 900);
});

test("transaction rollback leaves no typed row, version event, or outbox entry", async () => {
  const storage = new InMemoryLocalRepositoryStorage();
  const factory = new MobileRepositoryFactory(storage);
  const repos = factory.forUser(alice);
  const events: number[] = [];
  factory.changes.subscribe((change) => events.push(change.version));

  await assert.rejects(() =>
    repos.transaction(async () => {
      await repos.commits.commits.create(commitInput("rollback-commit"));
      await repos.health.waterLogs.create(waterInput());
      throw new Error("rollback");
    }),
  );

  assert.deepEqual(await repos.health.waterLogs.list({}), []);
  assert.deepEqual(await factory.outbox.list(alice.userId), []);
  assert.deepEqual(events, []);
});

test("outbox contains only the mutations of a confirmed commit after its transaction commits", async () => {
  const storage = new InMemoryLocalRepositoryStorage();
  const factory = new MobileRepositoryFactory(storage);
  const repos = factory.forUser(alice);
  let commitId = "";

  await repos.transaction(async () => {
    const envelope = await repos.commits.commits.create(commitInput("confirmed-commit"));
    commitId = envelope.id;
    await repos.health.waterLogs.create({ ...waterInput(1100), id: "water-confirmed" });
    assert.equal((await repos.commits.commits.byId(envelope.id))?.status, "committed");
  });

  const outbox = await factory.outbox.list(alice.userId);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]?.commitId, commitId);
  assert.deepEqual(
    outbox[0]?.mutations.map((mutation) => mutation.table).sort(),
    ["commits", "water_logs"],
  );
});

test("native migration ledger applies the shared contract and local state once", async () => {
  const storage = new InMemoryLocalRepositoryStorage();
  await applyNativeMigrations(storage);
  const first = await storage.select("sarthi_native_migrations", []);
  await applyNativeMigrations(storage);
  const second = await storage.select("sarthi_native_migrations", []);

  assert.equal(first.length, 3);
  assert.equal(second.length, 3);
});
