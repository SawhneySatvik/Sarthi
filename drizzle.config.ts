import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  // SQLite is the dev/CI dialect for SAR-003. Point at the sqlite dialect file only —
  // the glob would also match postgres.ts (pgTable) and break `drizzle-kit generate`.
  // The Postgres migration path is wired separately in SAR-021.
  schema: "./data/schema/sqlite.ts",
  out: "./data/migrations",
  dbCredentials: {
    url: process.env.DB_URL ?? "file:./sarthi.dev.db",
  },
});
