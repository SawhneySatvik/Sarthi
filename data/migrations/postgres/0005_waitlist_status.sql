-- PL-2 · selective-rollout status for the waitlist. Additive ALTER — the NOT NULL
-- DEFAULT backfills every existing row to 'pending', so it applies cleanly to a
-- populated table. Mirrors data/migrations/0005_waitlist_status.sql (SQLite) and
-- data/schema/postgres.ts. Applied after 0000_init by the pg seed / on deploy.
ALTER TABLE "waitlist" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;
