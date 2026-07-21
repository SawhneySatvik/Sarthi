/**
 * Expo SQLite implementation of the native storage seam. The Drizzle binding
 * is deliberately created with the immutable shared SQLite table declarations;
 * repository code stays descriptor-driven so every core port remains scoped.
 */
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import * as schema from "@schema/sqlite";

import type {
  LocalOutboxRow,
  LocalRepositoryStorage,
  SqliteCondition,
  SqlitePrimitive,
  SqliteRow,
} from "./types";

type ExpoExecutor = Pick<
  SQLiteDatabase,
  "runAsync" | "getAllAsync" | "execAsync"
>;

function quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function where(conditions: readonly SqliteCondition[]): { clause: string; values: SqlitePrimitive[] } {
  if (conditions.length === 0) return { clause: "", values: [] };
  return {
    clause: ` WHERE ${conditions.map((condition) => `${quote(condition.column)} = ?`).join(" AND ")}`,
    values: conditions.map((condition) => condition.value),
  };
}

/** The native connection plus the official Drizzle Expo binding for consumers that need it. */
export interface ExpoRepositoryDatabase {
  storage: LocalRepositoryStorage;
  native: SQLiteDatabase;
  db: ReturnType<typeof drizzle<typeof schema>>;
}

class ExpoSqliteRepositoryStorage implements LocalRepositoryStorage {
  #executor: ExpoExecutor;
  #transactionDepth = 0;

  constructor(readonly native: SQLiteDatabase) {
    this.#executor = native;
  }

  async insert(table: string, row: SqliteRow): Promise<void> {
    const columns = Object.keys(row);
    const values = Object.values(row);
    await this.#executor.runAsync(
      `INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      values,
    );
  }

  async select(table: string, conditions: readonly SqliteCondition[]): Promise<readonly SqliteRow[]> {
    const predicate = where(conditions);
    return this.#executor.getAllAsync<SqliteRow>(
      `SELECT * FROM ${quote(table)}${predicate.clause}`,
      predicate.values,
    );
  }

  async update(
    table: string,
    conditions: readonly SqliteCondition[],
    patch: SqliteRow,
  ): Promise<number> {
    const columns = Object.keys(patch);
    if (columns.length === 0) return 0;
    const predicate = where(conditions);
    const result = await this.#executor.runAsync(
      `UPDATE ${quote(table)} SET ${columns.map((column) => `${quote(column)} = ?`).join(", ")}${predicate.clause}`,
      [...Object.values(patch), ...predicate.values],
    );
    return result.changes;
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.#transactionDepth > 0) return work();
    let result: T;
    await this.native.withExclusiveTransactionAsync(async (transaction) => {
      const previous = this.#executor;
      this.#executor = transaction as unknown as ExpoExecutor;
      this.#transactionDepth += 1;
      try {
        result = await work();
      } finally {
        this.#transactionDepth -= 1;
        this.#executor = previous;
      }
    });
    return result!;
  }

  async executeMigration(sql: string): Promise<void> {
    await this.#executor.execAsync(sql);
  }

  async getMeta(key: string): Promise<string | null> {
    const rows = await this.select("sarthi_native_meta", [{ column: "key", value: key }]);
    return (rows[0]?.value as string | undefined) ?? null;
  }

  async bumpMetaCounter(key: string, updatedAt: string): Promise<number> {
    await this.#executor.runAsync(
      `INSERT INTO "sarthi_native_meta" ("key", "value", "updatedAt") VALUES (?, '1', ?)
       ON CONFLICT("key") DO UPDATE SET "value" = CAST("value" AS INTEGER) + 1, "updatedAt" = excluded."updatedAt"`,
      [key, updatedAt],
    );
    return Number(await this.getMeta(key));
  }

  async insertConfirmedOutbox(row: LocalOutboxRow): Promise<void> {
    await this.#executor.runAsync(
      `INSERT OR IGNORE INTO "sarthi_native_outbox"
       ("id", "userId", "commitId", "payloadJson", "createdAt", "state") VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.userId, row.commitId, row.payloadJson, row.createdAt, row.state],
    );
  }

  async listConfirmedOutbox(userId: string): Promise<readonly LocalOutboxRow[]> {
    const rows = await this.#executor.getAllAsync<LocalOutboxRow>(
      `SELECT * FROM "sarthi_native_outbox" WHERE "userId" = ? ORDER BY "createdAt" ASC`,
      [userId],
    );
    return rows;
  }
}

/**
 * Opens one durable device database. `ready` in the runtime is responsible for
 * applying migrations before any repository is handed to a screen.
 */
export function createExpoRepositoryDatabase(name = "sarthi-mobile.db"): ExpoRepositoryDatabase {
  const native = openDatabaseSync(name, { enableChangeListener: true });
  const db = drizzle(native, { schema });
  return { native, db, storage: new ExpoSqliteRepositoryStorage(native) };
}
