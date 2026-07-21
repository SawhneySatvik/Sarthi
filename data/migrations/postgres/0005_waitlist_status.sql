-- PL-2 · selective-rollout status for the waitlist. Additive ALTER — the NOT NULL
-- DEFAULT backfills every existing row to 'pending', so it applies cleanly to a
-- populated table. Mirrors data/migrations/0005_waitlist_status.sql (SQLite) and
-- data/schema/postgres.ts. Applied after 0000_init by the pg seed / on deploy.
-- `IF NOT EXISTS` makes re-application idempotent, so a DB already healed by the
-- seed-postgres column-heal (scripts/seed-postgres.ts) re-runs this as a no-op.
ALTER TABLE "waitlist" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
