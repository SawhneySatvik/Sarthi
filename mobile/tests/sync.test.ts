import assert from 'node:assert/strict';
import test from 'node:test';

import { NativeSyncEngine } from '../src/sync/engine';
import { createMemorySyncStore } from '../src/sync/testing';

const clock = { now: () => 1, createId: () => 'queue-row' };
const mutation = { userId: 'alice', idempotencyKey: 'commit-1', table: 'water_logs', operation: 'create' as const, payload: { millilitres: 1200 } };

test('dedupes an offline typed mutation and acknowledges it once on reconnect', async () => {
  const store = createMemorySyncStore();
  let pushes = 0;
  const engine = new NativeSyncEngine(store, { push: async () => { pushes += 1; return { kind: 'ack' as const }; }, pull: async () => ({ rows: [], watermark: null }) }, clock);
  await engine.enqueue(mutation);
  await engine.enqueue(mutation);

  const report = await engine.replay('alice');
  assert.equal(pushes, 1);
  assert.equal(report.acknowledged, 1);
  assert.deepEqual(store.snapshot('alice'), []);
});

test('keeps a queued mutation on authorization or network retry rather than dropping a confirmed local write', async () => {
  const store = createMemorySyncStore();
  const engine = new NativeSyncEngine(store, { push: async () => ({ kind: 'retry' as const, reason: 'unauthorized' as const }), pull: async () => ({ rows: [], watermark: null }) }, clock);
  await engine.enqueue(mutation);

  const report = await engine.replay('alice');
  assert.equal(report.retained, 1);
  assert.equal(store.snapshot('alice').length, 1);
  assert.equal(store.snapshot('alice')[0]?.state, 'pending');
});

test('partitions queue and inbound watermarks by user, then purges only the signed-out partition', async () => {
  const store = createMemorySyncStore();
  const engine = new NativeSyncEngine(store, { push: async () => ({ kind: 'ack' as const }), pull: async ({ userId }) => ({ rows: [], watermark: `${userId}-watermark` }) }, clock);
  await engine.enqueue(mutation);
  await engine.enqueue({ ...mutation, userId: 'bob', idempotencyKey: 'commit-2' });
  await engine.pull('alice', ['water_logs']);
  await engine.pull('bob', ['water_logs']);
  await engine.signOut('alice');

  assert.deepEqual(store.snapshot('alice'), []);
  assert.equal(store.snapshot('bob').length, 1);
  assert.equal(await store.getWatermark('alice', 'water_logs'), null);
  assert.equal(await store.getWatermark('bob', 'water_logs'), 'bob-watermark');
});
