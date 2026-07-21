/**
 * scripts/seed-postgres.ts — load the demo data into a REMOTE Postgres (Supabase)
 * database, mirroring scripts/seed-dev.ts (which is SQLite-only and stays untouched).
 *
 * It seeds under userId "local-dev" so the local-password auth provider (userId
 * "local-dev") sees the populated demo on the de-risk deploy. Delegates to the SHARED,
 * repo-typed `seedDemo` (data/seed/demo.ts) via the Postgres composition root, so the
 * populated state is identical to the SQLite dev seed and the in-app demo gesture.
 *
 * Schema: prefer provisioning with `drizzle-kit push` (see runbook). If the target is
 * a FRESH DB with no `profiles` table, this script applies the committed
 * data/migrations/postgres/*.sql first. Either way it VERIFIES `profiles.timezone`
 * exists before seeding (UIE-0a) and fails loudly if not.
 *
 *   DB_URL=postgresql://…  pnpm db:seed:postgres          # populated (default)
 *   DB_URL=postgresql://…  SEED_STATE=fresh pnpm db:seed:postgres   # schema only
 *
 * Run against the Supabase DIRECT / session connection string (DDL + seed), NOT the
 * transaction pooler.
 */
import { readFileSync, readdirSync } from "node:fs";

import postgres from "postgres";

import type { AuthenticatedUser } from "../core/contracts";
import { createPostgresRepositoryFactory } from "../data/repository";
import { seedDemo, type DemoSeedState } from "../data/seed/demo";

const DB_URL = process.env.DB_URL;
const USER: AuthenticatedUser = { userId: "local-dev", email: null, mode: "local" };
const STATE = process.env.SEED_STATE ?? "populated";
const MIGRATIONS_DIR = "data/migrations/postgres";

function requireUrl(): string {
  if (!DB_URL || DB_URL.startsWith("file:")) {
    throw new Error(
      "seed-postgres requires DB_URL set to a Postgres/Supabase connection string " +
        "(postgres://… or postgresql://…), not a file: URL. Use the Supabase DIRECT connection.",
    );
  }
  return DB_URL;
}

/**
 * Ensure the target has the full current schema, then hard-verify profiles.timezone.
 * On a fresh DB (no profiles table) apply the committed pg migration(s); otherwise
 * assume it was provisioned by `drizzle-kit push` (or a prior run) and only verify.
 */
async function ensureSchema(url: string): Promise<void> {
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const [{ present }] = await sql<{ present: boolean }[]>`
      SELECT to_regclass('public.profiles') IS NOT NULL AS present`;
    if (!present) {
      for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
        const content = readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8");
        for (const stmt of content.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) {
          await sql.unsafe(stmt);
        }
        console.log(`applied ${MIGRATIONS_DIR}/${file}`);
      }
    } else {
      console.log("schema already present — skipping migration apply (assumed drizzle-kit push or prior seed)");
    }

    const [{ hasTimezone }] = await sql<{ hasTimezone: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'timezone'
      ) AS "hasTimezone"`;
    if (!hasTimezone) {
      throw new Error(
        "profiles.timezone is MISSING — the live schema is out of date. Re-run " +
          "`drizzle-kit push --config=drizzle.config.postgres.ts` against data/schema/postgres.ts, then reseed.",
      );
    }
    console.log("verified profiles.timezone exists");
  } finally {
    await sql.end();
  }
}

async function main(): Promise<void> {
  const url = requireUrl();
  await ensureSchema(url);

  if (STATE === "fresh") {
    console.log("postgres schema ready (fresh) — no profile seeded (onboarding gate active)");
    return;
  }

  const repos = createPostgresRepositoryFactory(url).forUser(USER);
  const state: DemoSeedState = STATE === "empty" ? "empty" : STATE === "alldone" ? "alldone" : "populated";
  await seedDemo(repos, { state });
  console.log(`seeded postgres db (${state}) under userId=${USER.userId}`);
}

// The factory's postgres-js pool (createPostgresRepositoryFactory) is left open and
// has no close handle exposed, so an idle pooled connection keeps the event loop
// alive. Exit explicitly once work is done (data is already committed) rather than
// hang. Mirrors the one-shot-script pattern.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
