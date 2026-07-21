import type { SyncMutation, SyncQueueStore } from './contracts';

/** In-memory fake used by unit tests and simulator diagnostics. */
export function createMemorySyncStore(): SyncQueueStore & { snapshot(userId: string): SyncMutation[] } {
  const mutations = new Map<string, SyncMutation[]>();
  const watermarks = new Map<string, string>();
  const key = (userId: string, table: string) => `${userId}:${table}`;
  return {
    async listMutations(userId) {
      return [...(mutations.get(userId) ?? [])];
    },
    async putMutation(mutation) {
      const partition = mutations.get(mutation.userId) ?? [];
      const next = partition.filter((entry) => entry.id !== mutation.id);
      next.push(mutation);
      mutations.set(mutation.userId, next);
    },
    async deleteMutation(userId, id) {
      mutations.set(userId, (mutations.get(userId) ?? []).filter((entry) => entry.id !== id));
    },
    async getWatermark(userId, table) {
      return watermarks.get(key(userId, table)) ?? null;
    },
    async applyInbound(userId, table, _rows, watermark) {
      if (watermark) watermarks.set(key(userId, table), watermark);
    },
    async purgeUser(userId) {
      mutations.delete(userId);
      for (const watermarkKey of watermarks.keys()) {
        if (watermarkKey.startsWith(`${userId}:`)) watermarks.delete(watermarkKey);
      }
    },
    snapshot(userId) {
      return [...(mutations.get(userId) ?? [])];
    },
  };
}
