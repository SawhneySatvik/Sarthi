/**
 * Storage and transport seams for the native local-first sync loop.
 *
 * The SQLite adapter and Supabase client implement these ports elsewhere. Keeping this
 * module dependency-free lets the queue run in a simulator, against fakes, and in tests.
 */
export type MutationState = 'pending' | 'sending';

export type SyncMutation = {
  id: string;
  userId: string;
  idempotencyKey: string;
  table: string;
  operation: 'create' | 'update' | 'delete' | 'undo';
  payload: unknown;
  createdAtMs: number;
  attempts: number;
  state: MutationState;
};

export type NewSyncMutation = Omit<SyncMutation, 'id' | 'createdAtMs' | 'attempts' | 'state'>;

export type InboundChange = {
  table: string;
  row: unknown;
  updatedAt: string;
};

export type SyncQueueStore = {
  listMutations(userId: string): Promise<SyncMutation[]>;
  putMutation(mutation: SyncMutation): Promise<void>;
  deleteMutation(userId: string, id: string): Promise<void>;
  getWatermark(userId: string, table: string): Promise<string | null>;
  /** The implementation must apply rows and watermark atomically in the user's partition. */
  applyInbound(userId: string, table: string, rows: InboundChange[], watermark: string | null): Promise<void>;
  /** Removes the local repository partition, queue, and watermarks for a signed-out identity. */
  purgeUser(userId: string): Promise<void>;
};

export type PushResult =
  | { kind: 'ack' }
  | { kind: 'retry'; reason?: 'offline' | 'unauthorized' | 'rate-limited' | 'server' };

export type PullResult = {
  rows: InboundChange[];
  watermark: string | null;
};

/** Injected Supabase transport. It deliberately has no dependency on the Supabase SDK. */
export type SupabaseSyncTransport = {
  push(input: { userId: string; mutation: SyncMutation }): Promise<PushResult>;
  pull(input: { userId: string; table: string; after: string | null }): Promise<PullResult>;
};

export type SyncClock = {
  now(): number;
  createId(): string;
};

export const deviceClock: SyncClock = {
  now: () => Date.now(),
  createId: () => `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`,
};
