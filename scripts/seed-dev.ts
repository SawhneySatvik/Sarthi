/**
 * scripts/seed-dev.ts — a tiny DEV-ONLY seed so the Today spine has data to render
 * and screenshot (SAR-005). NOT the judge seed (SAR-020). Applies the committed
 * migration to the local SQLite file, then delegates to the SHARED, repo-typed
 * `seedDemo` (data/seed/demo.ts) so the dev script and the in-app long-press gesture
 * (SAR-012 D-G) stay ONE seed. Keyless.
 *
 *   pnpm db:seed:dev
 */
import { readFileSync, readdirSync, rmSync } from "node:fs";

import { createClient } from "@libsql/client";

import type { AuthenticatedUser } from "../core/contracts";
import { createSqliteRepositoryFactory } from "../data/repository";
import { seedDemo, type DemoSeedState } from "../data/seed/demo";

const DB_URL = process.env.DB_URL ?? "file:./sarthi.dev.db";
const FILE = DB_URL.replace(/^file:/, "");
const USER: AuthenticatedUser = { userId: "local-dev", email: null, mode: "local" };
/**
 * populated (default) · empty (new-user, no arc) · alldone (every item complete) · fresh
 * (no profile at all → the SAR-012 onboarding gate routes to /onboarding) — screenshot states.
 */
const STATE = process.env.SEED_STATE ?? "populated";

async function applyMigrations(): Promise<void> {
  const client = createClient({ url: DB_URL });
  const dir = "data/migrations";
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(`${dir}/${file}`, "utf8");
    for (const stmt of sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) {
      await client.execute(stmt);
    }
  }
  client.close();
}

async function main(): Promise<void> {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(`${FILE}${suffix}`, { force: true });
  }
  await applyMigrations();

  if (STATE === "fresh") {
    // SAR-012 (D-A) — the true new-user landing state: migrations only, no profile row,
    // no entities. The (app) shell gate finds no `complete` profile and routes to
    // /onboarding, so this is the state the onboarding shots/tests run against.
    console.log(`seeded dev db (fresh) at ${DB_URL} — no profile, onboarding gate active`);
    return;
  }

  // The dev script always resets the file first, so the `seed_runs` guard inside `seedDemo`
  // is a clean pass here — the same shared body the demo gesture runs (SAR-012 D-G).
  const repos = createSqliteRepositoryFactory(DB_URL).forUser(USER);
  const state: DemoSeedState = STATE === "empty" ? "empty" : STATE === "alldone" ? "alldone" : "populated";
  await seedDemo(repos, { state });
  console.log(`seeded dev db (${state}) at ${DB_URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
