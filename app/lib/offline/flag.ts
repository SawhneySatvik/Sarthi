/**
 * app/lib/offline/flag.ts — the single gate for the T10/PL-3 offline additive queue.
 *
 * EVERYTHING in the offline layer (IndexedDB wrapper, durable-state mirror, capture
 * mutation queue + replay, and the service-worker stale-while-revalidate read cache)
 * is behind `NEXT_PUBLIC_ENABLE_OFFLINE_QUEUE === "1"`. Left UNSET, `offlineQueueEnabled()`
 * returns false and NONE of that code runs — the capture/tool/client-state paths are
 * byte-for-byte identical to today (same fetches, same `router.refresh()`, same F3).
 *
 * `process.env.NEXT_PUBLIC_*` is inlined at build time, so a flag-off build tree-shakes
 * the guarded branches to dead code that never touches IndexedDB.
 */
export function offlineQueueEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_OFFLINE_QUEUE === "1";
}
