/**
 * Narrow persistence seam for the native repository. It deliberately exposes
 * table/row operations instead of a SQL driver to the repository layer: the
 * production implementation is Expo SQLite, while tests use the same contract
 * in memory. No core code imports this module.
 */

export type SqlitePrimitive = string | number | null;
export type SqliteRow = Record<string, SqlitePrimitive>;

export interface SqliteCondition {
  column: string;
  value: SqlitePrimitive;
}

export interface LocalOutboxRow {
  id: string;
  userId: string;
  commitId: string;
  payloadJson: string;
  createdAt: string;
  state: "pending" | "acked";
}

/**
 * This is the sole storage dependency of the repository adapter. Production
 * implements it with Expo's `SQLiteDatabase`; in-memory implementations are
 * intentionally kept here so transaction and tenancy behavior can be tested
 * without importing native modules.
 */
export interface LocalRepositoryStorage {
  insert(table: string, row: SqliteRow): Promise<void>;
  select(table: string, conditions: readonly SqliteCondition[]): Promise<readonly SqliteRow[]>;
  update(
    table: string,
    conditions: readonly SqliteCondition[],
    patch: SqliteRow,
  ): Promise<number>;
  /** Only native adapters call this with a user-bound predicate. */
  delete(table: string, conditions: readonly SqliteCondition[]): Promise<number>;
  transaction<T>(work: () => Promise<T>): Promise<T>;

  /** Execute trusted, bundled migration SQL. Never accept application input. */
  executeMigration(sql: string): Promise<void>;

  getMeta(key: string): Promise<string | null>;
  bumpMetaCounter(key: string, updatedAt: string): Promise<number>;
  insertConfirmedOutbox(row: LocalOutboxRow): Promise<void>;
  listConfirmedOutbox(userId: string): Promise<readonly LocalOutboxRow[]>;
  markConfirmedOutboxQueued(userId: string, id: string): Promise<void>;
}
