import { defineConfig } from "drizzle-kit";

/**
 * drizzle.config.postgres.ts — the Postgres (prod / Supabase) migration config.
 *
 * Separate from drizzle.config.ts (SQLite dev/CI) so the two dialects never share
 * a migration journal. Points ONLY at the Postgres dialect schema and writes to a
 * dedicated `data/migrations/postgres/` dir. Generation is offline (schema → SQL,
 * no DB connection). Apply against the Supabase DIRECT connection string (DDL),
 * not the transaction pooler — see the deploy runbook.
 *
 *   pnpm db:generate:postgres      # regenerate from data/schema/postgres.ts
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./data/schema/postgres.ts",
  out: "./data/migrations/postgres",
  dbCredentials: {
    url: process.env.DB_URL ?? "postgres://localhost:5432/sarthi",
  },
});
