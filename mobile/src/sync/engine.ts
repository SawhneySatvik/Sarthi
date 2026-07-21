import {
  deviceClock,
  type NewSyncMutation,
  type SupabaseSyncTransport,
  type SyncClock,
  type SyncMutation,
  type SyncQueueStore,
} from './contracts';

export type ReplayReport = {
  acknowledged: number;
  retained: number;
  refused: number;
};

/**
 * A per-user durable queue. Local typed writes happen before `enqueue`; replay is only a
 * replication concern. A response lost after a server write is safe because every replay
 * retains the original idempotency key.
 */
export class NativeSyncEngine {
  private replayingUsers = new Set<string>();

  constructor(
    private readonly store: SyncQueueStore,
    private readonly transport: SupabaseSyncTransport,
    private readonly clock: SyncClock = deviceClock,
  ) {}

  async enqueue(input: NewSyncMutation): Promise<SyncMutation> {
    const existing = (await this.store.listMutations(input.userId)).find(
      (mutation) => mutation.idempotencyKey === input.idempotencyKey,
    );
    if (existing) return existing;

    const mutation: SyncMutation = {
      ...input,
      id: this.clock.createId(),
      createdAtMs: this.clock.now(),
      attempts: 0,
      state: 'pending',
    };
    await this.store.putMutation(mutation);
    return mutation;
  }

  /** Recover mutations left in-flight by an app termination before the first replay. */
  async reclaimInFlight(userId: string): Promise<number> {
    const mutations = await this.store.listMutations(userId);
    const stuck = mutations.filter((mutation) => mutation.state === 'sending');
    await Promise.all(stuck.map((mutation) => this.store.putMutation({ ...mutation, state: 'pending' })));
    return stuck.length;
  }

  async replay(userId: string): Promise<ReplayReport> {
    if (this.replayingUsers.has(userId)) return { acknowledged: 0, retained: 0, refused: 0 };
    this.replayingUsers.add(userId);
    try {
      const pending = (await this.store.listMutations(userId))
        .filter((mutation) => mutation.state === 'pending')
        .sort((left, right) => left.createdAtMs - right.createdAtMs);
      let acknowledged = 0;
      let retained = 0;
      let refused = 0;

      for (const mutation of pending) {
        // Defensive: a malformed adapter must never cross-write another user's partition.
        if (mutation.userId !== userId) {
          refused += 1;
          continue;
        }
        const sending = { ...mutation, state: 'sending' as const, attempts: mutation.attempts + 1 };
        await this.store.putMutation(sending);
        try {
          const result = await this.transport.push({ userId, mutation: sending });
          if (result.kind === 'ack') {
            await this.store.deleteMutation(userId, mutation.id);
            acknowledged += 1;
          } else {
            // 401, 429, 5xx, and offline errors are never dropped. Authentication may recover.
            await this.store.putMutation({ ...sending, state: 'pending' });
            retained += 1;
          }
        } catch {
          await this.store.putMutation({ ...sending, state: 'pending' });
          retained += 1;
        }
      }
      return { acknowledged, retained, refused };
    } finally {
      this.replayingUsers.delete(userId);
    }
  }

  async pull(userId: string, tables: readonly string[]): Promise<void> {
    for (const table of tables) {
      const after = await this.store.getWatermark(userId, table);
      const result = await this.transport.pull({ userId, table, after });
      await this.store.applyInbound(userId, table, result.rows, result.watermark);
    }
  }

  async sync(userId: string, tables: readonly string[]): Promise<ReplayReport> {
    const report = await this.replay(userId);
    await this.pull(userId, tables);
    return report;
  }

  async signOut(userId: string): Promise<void> {
    this.replayingUsers.delete(userId);
    await this.store.purgeUser(userId);
  }
}
