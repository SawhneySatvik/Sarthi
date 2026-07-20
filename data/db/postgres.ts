/**
 * data/db/postgres.ts — the Postgres (prod) driver root.
 *
 * Composition-ready and NOT exercised in CI (the keyless `fake` stack runs on
 * SQLite). Two settings make it safe behind Supabase's transaction-mode pooler
 * on Vercel serverless:
 *   - `prepare: false` — the transaction pooler does not support prepared
 *     statements (named-statement reuse across pooled backends is invalid).
 *   - `max: 1` — each warm serverless instance keeps at most ONE backend open.
 *     postgres-js defaults to 10; N warm lambdas × 10 would exhaust the pooler.
 * The repository logic in data/repository is dialect-agnostic and binds to this
 * handle via the Postgres composition root (data/repository/factory.ts).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/data/schema/postgres";

export type PostgresDb = ReturnType<typeof createPostgresDb>;

export function createPostgresDb(url: string) {
  const sql = postgres(url, { prepare: false, max: 1 });
  return drizzle(sql, { schema });
}
