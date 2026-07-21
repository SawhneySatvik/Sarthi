-- COACH-1 · two-layer coach memory (Postgres). Coach INFRA, not a fifth domain
-- (D-054). ADDITIVE ONLY: three brand-new tables, `IF NOT EXISTS` throughout, zero
-- existing rows touched — same posture as data/migrations/postgres/0005_waitlist_status.sql.
-- Mirrors data/migrations/0006_coach_memory.sql (SQLite) and data/schema/postgres.ts.
-- Applied after 0000_init by the pg seed / on deploy; re-application is a no-op.
CREATE TABLE IF NOT EXISTS "coach_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"createdAt" text NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"localDate" text NOT NULL,
	"toolLogJson" jsonb,
	"proposedAdaptationId" text,
	"modelProvider" text,
	"modelId" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_messages_userId_createdAt_idx" ON "coach_messages" ("userId","createdAt");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"createdAt" text NOT NULL,
	"domain" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"useCount" integer DEFAULT 0 NOT NULL,
	"lastUsedAt" text,
	"sourceCaptureId" text,
	"estimated" boolean NOT NULL,
	"confidenceBps" integer NOT NULL,
	"retired" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_memory_userId_domain_idx" ON "coach_memory" ("userId","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_memory_userId_pinned_idx" ON "coach_memory" ("userId","pinned");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_memory_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"createdAt" text NOT NULL,
	"memoryId" text NOT NULL,
	"kind" text NOT NULL,
	"confidenceTier" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_memory_audit_userId_memoryId_idx" ON "coach_memory_audit" ("userId","memoryId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_memory_audit_userId_createdAt_idx" ON "coach_memory_audit" ("userId","createdAt");
