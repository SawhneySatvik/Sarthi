/**
 * app/lib/offline/durable-state.ts — durable client-state MIRROR (T10 requirement #2).
 *
 * When the flag is on, key client state (tool-run, theme) is write-through mirrored into
 * the IndexedDB `kv` store so it survives reload/offline across a browser restart. The
 * existing localStorage/sessionStorage remains the SOURCE OF TRUTH and the synchronous
 * read path — the mirror is purely additive, so flag-off behavior is untouched. All calls
 * are guarded by `offlineQueueEnabled()` and are best-effort (never throw).
 */
import { offlineQueueEnabled } from "./flag";
import { idbGet, idbPut, KV_STORE } from "./idb";

interface KvRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

/** Write-through a durable value under `key`. No-op unless the flag is on. */
export async function mirrorDurableState(key: string, value: unknown): Promise<void> {
  if (!offlineQueueEnabled()) return;
  await idbPut<KvRecord>(KV_STORE, { key, value, updatedAt: Date.now() });
}

/** Read a mirrored value (used as a fallback when the primary store is empty). */
export async function readDurableState<T>(key: string): Promise<T | null> {
  if (!offlineQueueEnabled()) return null;
  const record = await idbGet<KvRecord>(KV_STORE, key);
  return record ? (record.value as T) : null;
}
