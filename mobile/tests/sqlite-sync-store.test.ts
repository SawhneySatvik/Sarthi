import assert from "node:assert/strict";
import test from "node:test";

import { MobileRepositoryFactory } from "../src/adapters/repository/factory";
import { applyNativeMigrations } from "../src/db/migrations";
import { InMemoryLocalRepositoryStorage } from "../src/db/memory";
import { ConfirmedOutboxSyncBridge } from "../src/sync/bridge";
import { NativeSyncEngine } from "../src/sync/engine";
import { SqliteSyncQueueStore } from "../src/sync/sqlite-store";

const alice = { userId: "user-alice", email: "alice@example.test", mode: "local" as const };
const bob = { userId: "user-bob", email: "bob@example.test", mode: "local" as const };
const clock = { now: () => 1, createId: () => "queue-row" };

function waterRow(userId: string, updatedAt: string, millilitres: number) {
  return {
    id: `water-${userId}`,
    userId,
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
    occurredAt: updatedAt,
    localDate: "2026-07-21",
    timezone: "Asia/Kolkata",
    millilitres,
    source: "capture",
    confidenceBps: 10000,
    estimated: false,
  };
}

test("SQLite sync store applies only the active user's newer typed inbound snapshot", async () => {
  const storage = new InMemoryLocalRepositoryStorage();
  await applyNativeMigrations(storage);
  const store = new SqliteSyncQueueStore(storage);
  const latest = waterRow(alice.userId, "2026-07-21T09:00:00.000Z", 1250);
  await store.applyInbound(alice.userId, "water_logs", [{ table: "water_logs", row: latest, updatedAt: latest.updatedAt }], latest.updatedAt);
  await store.applyInbound(alice.userId, "water_logs", [{ table: "water_logs", row: waterRow(alice.userId, "2026-07-21T08:00:00.000Z", 400), updatedAt: "2026-07-21T08:00:00.000Z" }], "2026-07-21T08:00:00.000Z");
  await store.applyInbound(alice.userId, "water_logs", [{ table: "water_logs", row: waterRow(bob.userId, "2026-07-21T10:00:00.000Z", 2000), updatedAt: "2026-07-21T10:00:00.000Z" }], "2026-07-21T10:00:00.000Z");

  const rows = await storage.select("water_logs", [{ column: "userId", value: alice.userId }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.millilitres, 1250);
  assert.equal(await store.getWatermark(alice.userId, "water_logs"), "2026-07-21T10:00:00.000Z");
});

test("confirmed repository transactions become durable, user-partitioned sync mutations exactly once", async () => {
  const storage = new InMemoryLocalRepositoryStorage();
  await applyNativeMigrations(storage);
  const factory = new MobileRepositoryFactory(storage, { createId: () => "id-1" });
  const repos = factory.forUser(alice);
  await repos.transaction(async () => {
    await repos.commits.commits.create({ id: "commit-1", idempotencyKey: "capture-1", draftId: "draft-1", kind: "capture", status: "committed", undoExpiresAt: "2026-07-21T05:15:00.000Z", undoneAt: null, summary: "one local water log" });
    await repos.health.waterLogs.create({ ...waterRow(alice.userId, "2026-07-21T05:10:00.000Z", 900), id: "water-1" });
  });
  const queue = new SqliteSyncQueueStore(storage);
  let sequence = 0;
  const engine = new NativeSyncEngine(queue, { push: async () => ({ kind: "ack" as const }), pull: async () => ({ rows: [], watermark: null }) }, { now: () => 1, createId: () => `queue-${sequence++}` });
  const bridge = new ConfirmedOutboxSyncBridge(storage, factory.outbox, engine);

  assert.equal(await bridge.enqueueConfirmed(alice.userId), 2);
  assert.equal(await bridge.enqueueConfirmed(alice.userId), 0);
  assert.equal((await queue.listMutations(alice.userId)).length, 2);
  await queue.putMutation({ id: "bob-only", userId: bob.userId, idempotencyKey: "bob-1", table: "water_logs", operation: "create", payload: waterRow(bob.userId, "2026-07-21T06:00:00.000Z", 500), createdAtMs: 2, attempts: 0, state: "pending" });
  await queue.purgeUser(alice.userId);
  assert.equal((await queue.listMutations(alice.userId)).length, 0);
  assert.equal((await queue.listMutations(bob.userId)).length, 1);
});
