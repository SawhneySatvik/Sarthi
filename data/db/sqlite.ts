/**
 * data/db/sqlite.ts — the libSQL driver root.
 *
 * Owns the libSQL client + Drizzle binding. `url` is a libSQL URL, e.g.
 * "file:./sarthi.dev.db" for an on-disk dev database or ":memory:" for tests.
 * `authToken` is OPTIONAL: it is ignored for local `file:`/`:memory:` urls (so
 * keyless dev is unchanged) and supplied only for a hosted libSQL/Turso url — a
 * kept fallback transport. Prod runs on Postgres (data/db/postgres.ts); this
 * driver stays the SQLite dev/CI path and the optional libSQL fallback.
 * The repository layer (data/repository) composes over the returned handle;
 * business logic never sees this driver directly.
 */
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

import * as schema from "@/data/schema/sqlite";

export type SqliteDb = ReturnType<typeof createSqliteDb>;

export function createSqliteDb(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}
