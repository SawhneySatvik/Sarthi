/**
 * app/lib/offline/capture-queue.ts — the IndexedDB-backed capture mutation queue + replay.
 *
 * Wires the pure `queue.ts` logic to the IndexedDB `mutations` store and to `fetch`. All
 * exports are guarded so nothing runs unless `offlineQueueEnabled()`. The queue targets
 * ONLY commit/undo (parse needs the network/LLM and cannot run offline — see the capture
 * client's honest-degrade path). The server stays authoritative: an offline commit is
 * NOT a typed write; the real typed write happens only when this replays to the server.
 */
import { offlineQueueEnabled } from "./flag";
import { idbDelete, idbGetAll, idbPut, MUTATIONS_STORE } from "./idb";
import {
  enqueue,
  listPending,
  reclaimInFlight,
  replay,
  type NewMutation,
  type PostOutcome,
  type QueueBackend,
  type QueuedMutation,
  type ReplayResult,
} from "./queue";

const SYNC_TAG = "sarthi-capture-replay";

/** IndexedDB implementation of the pure queue's persistence seam. */
const backend: QueueBackend = {
  getAll: () => idbGetAll<QueuedMutation>(MUTATIONS_STORE),
  put: (mutation) => idbPut(MUTATIONS_STORE, mutation),
  delete: (id) => idbDelete(MUTATIONS_STORE, id),
};

/** Register a Background Sync so the SW can nudge replay after reconnect, when supported. */
async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sync = (registration as unknown as { sync?: { register(tag: string): Promise<void> } }).sync;
    if (sync) await sync.register(SYNC_TAG);
  } catch {
    /* Background Sync is a progressive enhancement; the `online` handler is the primary path */
  }
}

/** Queue a genuinely-offline capture mutation (deduped by idempotency key). */
export async function enqueueCaptureMutation(input: NewMutation): Promise<void> {
  if (!offlineQueueEnabled()) return;
  await enqueue(backend, input);
  void requestBackgroundSync();
}

/** How many mutations are still waiting to sync (for a "pending sync" affordance). */
export async function pendingCaptureCount(): Promise<number> {
  if (!offlineQueueEnabled()) return 0;
  return (await listPending(backend)).length;
}

/**
 * POST one queued mutation. A DEFINITIVE HTTP response (any status, including the server's
 * idempotent-replay 200 or an undo 409) is an `ack` — stop retrying. Only a thrown fetch
 * (server unreachable) is a `retry`.
 */
async function postMutation(mutation: QueuedMutation): Promise<PostOutcome> {
  try {
    const res = await fetch(mutation.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...mutation.headers },
      body: JSON.stringify(mutation.body),
    });
    // Consume the body so the connection is released; the result is authoritative on the
    // server (router.refresh will surface the write), so we don't thread it back here.
    await res.text().catch(() => "");
    return "ack";
  } catch {
    return "retry";
  }
}

// Reclaim orphaned in-flight rows exactly ONCE per page load, before the first replay.
// Subsequent same-session replays must NOT reclaim (they would clobber a live in-flight
// row); the OfflineQueueReplay `draining` guard serializes replays within a tab.
let reclaimedThisSession = false;

/** Replay the whole queue on reconnect. Safe to call repeatedly (at-most-once per row). */
export async function replayCaptureQueue(): Promise<ReplayResult[]> {
  if (!offlineQueueEnabled()) return [];
  if (!reclaimedThisSession) {
    reclaimedThisSession = true;
    await reclaimInFlight(backend);
  }
  return replay(backend, postMutation);
}
