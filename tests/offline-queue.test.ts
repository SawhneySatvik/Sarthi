/**
 * tests/offline-queue.test.ts — the T10/PL-3 offline capture mutation queue (pure logic).
 *
 * Exercises the storage-agnostic queue in `app/lib/offline/queue.ts` against an in-memory
 * backend (the same seam IndexedDB implements at runtime). Proves the safety core:
 *  - enqueue DEDUPES by idempotency key (a re-queued mutation is one row);
 *  - replay ACKs remove the row and it replays AT MOST ONCE;
 *  - a `retry` (server unreachable) leaves the row queued for the next reconnect;
 *  - the "server wrote but the response was lost" case: first replay throws (retry),
 *    the second replay ACKs (server key-dedupe) — a single row, removed exactly once;
 *  - an in-flight (`sent`) row is invisible to a concurrent replay pass, so it is not
 *    double-sent.
 * Keyless, network-free.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  enqueue,
  listPending,
  reclaimInFlight,
  replay,
  type NewMutation,
  type PostOutcome,
  type QueueBackend,
  type QueuedMutation,
} from "../app/lib/offline/queue";

/** An in-memory implementation of the queue's persistence seam. */
function memoryBackend(): QueueBackend & { rows: Map<string, QueuedMutation> } {
  const rows = new Map<string, QueuedMutation>();
  return {
    rows,
    async getAll() {
      return [...rows.values()].map((m) => ({ ...m }));
    },
    async put(mutation) {
      rows.set(mutation.id, { ...mutation });
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

function commitInput(key: string): NewMutation {
  return {
    idempotencyKey: key,
    kind: "commit",
    url: "/api/capture/commit",
    body: { proposals: [], idempotencyKey: key, kind: "capture", mode: "accept" },
    headers: { "content-type": "application/json" },
  };
}

test("enqueue persists a pending mutation", async () => {
  const backend = memoryBackend();
  const mutation = await enqueue(backend, commitInput("k1"));
  assert.equal(mutation.status, "pending");
  assert.equal(mutation.idempotencyKey, "k1");
  const pending = await listPending(backend);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].idempotencyKey, "k1");
});

test("enqueue DEDUPES by idempotency key — same key never doubles up", async () => {
  const backend = memoryBackend();
  const first = await enqueue(backend, commitInput("dupe"));
  const second = await enqueue(backend, commitInput("dupe"));
  assert.equal(first.id, second.id, "same key returns the existing row");
  assert.equal(backend.rows.size, 1);
  const pending = await listPending(backend);
  assert.equal(pending.length, 1);
});

test("distinct keys enqueue distinct rows, ordered by createdAt", async () => {
  const backend = memoryBackend();
  await enqueue(backend, commitInput("a"), 100);
  await enqueue(backend, commitInput("b"), 50);
  await enqueue(backend, commitInput("c"), 75);
  const pending = await listPending(backend);
  assert.deepEqual(
    pending.map((m) => m.idempotencyKey),
    ["b", "c", "a"],
  );
});

test("replay ACK removes the row — a mutation replays AT MOST ONCE", async () => {
  const backend = memoryBackend();
  await enqueue(backend, commitInput("once"));
  const posted: string[] = [];
  const post = async (m: QueuedMutation): Promise<PostOutcome> => {
    posted.push(m.idempotencyKey);
    return "ack";
  };
  const first = await replay(backend, post);
  assert.deepEqual(first.map((r) => r.acked), [true]);
  assert.equal(backend.rows.size, 0, "acked row is removed");

  // A second reconnect finds nothing to send — the mutation cannot fire twice.
  const second = await replay(backend, post);
  assert.equal(second.length, 0);
  assert.deepEqual(posted, ["once"], "posted exactly once across two replays");
});

test("replay RETRY keeps the row queued for the next reconnect", async () => {
  const backend = memoryBackend();
  await enqueue(backend, commitInput("flaky"));
  const post = async (): Promise<PostOutcome> => "retry";
  const result = await replay(backend, post);
  assert.deepEqual(result.map((r) => r.acked), [false]);
  const stillPending = await listPending(backend);
  assert.equal(stillPending.length, 1, "row survives an unreachable server");
  assert.equal(stillPending[0].attempts, 1, "attempt was counted");
});

test("a thrown poster is treated as retry (row survives)", async () => {
  const backend = memoryBackend();
  await enqueue(backend, commitInput("throws"));
  const post = async (): Promise<PostOutcome> => {
    throw new Error("network down");
  };
  const result = await replay(backend, post);
  assert.deepEqual(result.map((r) => r.acked), [false]);
  assert.equal((await listPending(backend)).length, 1);
});

test("response-lost-after-write: retry then ACK removes the row exactly once", async () => {
  const backend = memoryBackend();
  await enqueue(backend, commitInput("lost-ack"));
  let call = 0;
  // 1st replay: server wrote, but the connection dropped before the response → retry.
  // 2nd replay: same idempotency key → server returns the reconstructed result → ack.
  const post = async (): Promise<PostOutcome> => {
    call += 1;
    return call === 1 ? "retry" : "ack";
  };
  const first = await replay(backend, post);
  assert.deepEqual(first.map((r) => r.acked), [false]);
  assert.equal(backend.rows.size, 1, "still queued after the lost response");

  const second = await replay(backend, post);
  assert.deepEqual(second.map((r) => r.acked), [true]);
  assert.equal(backend.rows.size, 0, "removed exactly once after the server dedupe ACK");
  assert.equal(call, 2, "posted twice, but the server key-dedupe guarantees one write");
});

test("an in-flight (sent) row is invisible to a concurrent replay pass", async () => {
  const backend = memoryBackend();
  const mutation = await enqueue(backend, commitInput("inflight"));
  // Simulate a pass that flipped the row to in-flight before its POST resolved.
  await backend.put({ ...mutation, status: "sent", attempts: 1 });
  const pending = await listPending(backend);
  assert.equal(pending.length, 0, "a concurrent replay would find nothing to send");
});

test("enqueue REFUSES a non-/api/capture/ URL — no coach mutation can queue (§2.6)", async () => {
  const backend = memoryBackend();
  // The online-only coach mutations must never be queueable for offline replay.
  const coachAsk: NewMutation = { idempotencyKey: "coach-1", kind: "commit", url: "/api/coach/ask", body: {} };
  const coachAdaptation: NewMutation = { idempotencyKey: "coach-2", kind: "commit", url: "/api/coach/adaptation", body: {} };
  const coachMemory: NewMutation = { idempotencyKey: "coach-3", kind: "commit", url: "/api/coach/memory", body: {} };
  for (const bad of [coachAsk, coachAdaptation, coachMemory]) {
    await assert.rejects(() => enqueue(backend, bad), /only \/api\/capture\//);
  }
  assert.equal(backend.rows.size, 0, "nothing was persisted for a refused URL");
  // The capture paths still enqueue normally.
  await enqueue(backend, commitInput("ok"));
  await enqueue(backend, { idempotencyKey: "undo-ok", kind: "undo", url: "/api/capture/undo", body: {} });
  assert.equal(backend.rows.size, 2, "both capture commit and undo URLs are accepted");
});

test("reclaimInFlight recovers a crashed session's orphaned `sent` row, then it replays", async () => {
  const backend = memoryBackend();
  const mutation = await enqueue(backend, commitInput("orphan"));
  // A previous session flipped it to in-flight then died before ack/retry.
  await backend.put({ ...mutation, status: "sent", attempts: 1 });
  assert.equal((await listPending(backend)).length, 0, "orphan is invisible until reclaimed");

  const reclaimed = await reclaimInFlight(backend);
  assert.equal(reclaimed, 1);
  const pending = await listPending(backend);
  assert.equal(pending.length, 1, "orphan is back in the pending queue — never lost");

  // The reclaimed row replays and ACKs (server key-dedupe makes the re-POST safe).
  const result = await replay(backend, async () => "ack");
  assert.deepEqual(result.map((r) => r.acked), [true]);
  assert.equal(backend.rows.size, 0);
});
