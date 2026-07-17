/**
 * data/db/sqlite.ts — the SQLite (dev) driver root.
 *
 * Owns the libSQL client + Drizzle binding. `url` is a libSQL URL, e.g.
 * "file:./sarthi.dev.db" for an on-disk dev database or ":memory:" for tests.
 * The repository layer (data/repository) composes over the returned handle;
 * business logic never sees this driver directly.
 */
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

import * as schema from "@/data/schema/sqlite";

export type SqliteDb = ReturnType<typeof createSqliteDb>;

export function createSqliteDb(url: string) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}
