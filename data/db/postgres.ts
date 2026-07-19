/**
 * data/db/postgres.ts — the Postgres (prod) driver root.
 *
 * Composition-ready and intentionally NOT exercised in CI (the keyless `fake`
 * stack runs on SQLite). `prepare: false` is required by Supabase's
 * transaction-mode connection pooler, which does not support prepared
 * statements. The repository logic in data/repository is dialect-agnostic and
 * binds to this handle later (SAR-021).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/data/schema/postgres";

export type PostgresDb = ReturnType<typeof createPostgresDb>;

export function createPostgresDb(url: string) {
  const sql = postgres(url, { prepare: false });
  return drizzle(sql, { schema });
}
