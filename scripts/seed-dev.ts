/**
 * scripts/seed-dev.ts — a tiny DEV-ONLY seed so the Today spine has data to render
 * and screenshot (SAR-005). NOT the judge seed (SAR-020). Applies the committed
 * migration to the local SQLite file, then writes a small local-dev plan for today
 * through the typed repositories (no raw SQL inserts). Keyless.
 *
 *   pnpm db:seed:dev
 */
import { readFileSync, readdirSync, rmSync } from "node:fs";

import { createClient } from "@libsql/client";

import type { AuthenticatedUser } from "../core/contracts";
import { createSqliteRepositoryFactory } from "../data/repository";
import { seedCanonicalEntities } from "../data/seed/canonical";

const DB_URL = process.env.DB_URL ?? "file:./sarthi.dev.db";
const FILE = DB_URL.replace(/^file:/, "");
const USER: AuthenticatedUser = { userId: "local-dev", email: null, mode: "local" };
/** populated (default) · empty (new-user, no arc) · alldone (every item complete) — for screenshot states. */
const STATE = process.env.SEED_STATE ?? "populated";

function isoDaysFromToday(delta: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const today = isoDaysFromToday(0);

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

  const repos = createSqliteRepositoryFactory(DB_URL).forUser(USER);

  // The entities the canonical capture fixture resolves against (F3 strip; D-K).
  await seedCanonicalEntities(repos);

  if (STATE === "empty") {
    // New-user / nothing-planned Today: canonical entities exist (capture still works), no arc/items.
    console.log(`seeded dev db (empty) at ${DB_URL}`);
    return;
  }

  const arc = await repos.plans.arcs.create({
    domain: "overall",
    mode: "build",
    title: "First 30 days",
    startDate: isoDaysFromToday(-4),
    endDate: isoDaysFromToday(25),
    dayNumber: 5,
    status: "active",
  });

  await repos.plans.progress.create({ domain: "overall", xp: 640, level: 3, streak: 6, bestStreak: 8, cumulativeMinutes: 1240, lastActiveDate: today });
  await repos.plans.progress.create({ domain: "health", xp: 120, level: 2, streak: 4, bestStreak: 4, cumulativeMinutes: 0, lastActiveDate: today });
  await repos.plans.progress.create({ domain: "skills", xp: 260, level: 2, streak: 6, bestStreak: 6, cumulativeMinutes: 900, lastActiveDate: today });

  const item = (over: Partial<Parameters<typeof repos.plans.items.create>[0]>) =>
    repos.plans.items.create({
      arcId: arc.id,
      domain: "health",
      kind: "task",
      title: "",
      dueAt: null,
      localDate: today,
      targetValue: null,
      targetUnit: null,
      status: "active",
      completionSource: null,
      ruleJson: null,
      linkedHabitId: null,
      linkedSkillId: null,
      ...over,
    });

  // In `alldone`, the open items are completed (Today collapses to the celebration state).
  const done = STATE === "alldone";
  await item({ domain: "skills", kind: "target", title: "Deep work: system design", targetValue: 30, targetUnit: "minutes", status: done ? "done" : "active", completionSource: done ? "manual" : null });
  await item({ domain: "health", title: "Log lunch", status: done ? "done" : "pending", completionSource: done ? "manual" : null });
  await item({ domain: "habits", title: "Evening walk", status: done ? "done" : "pending", completionSource: done ? "manual" : null });
  await item({ domain: "health", title: "Drink water", status: "done", completionSource: "capture" });
  await item({ domain: "habits", title: "Meditate 10m", status: "done", completionSource: "manual" });

  // A couple of Health entries so the Health lens rings render with data.
  await repos.health.meals.create({
    occurredAt: `${today}T07:30:00.000Z`, localDate: today, timezone: "UTC",
    kcal: 620, proteinGrams: 24, carbsGrams: 78, fatGrams: 18,
    source: "capture", confidenceBps: 9000, estimated: false, evidenceId: null, note: "Breakfast",
  });
  await repos.health.waterLogs.create({
    occurredAt: `${today}T09:00:00.000Z`, localDate: today, timezone: "UTC",
    millilitres: 900, source: "capture", confidenceBps: 9500, estimated: false,
  });

  await repos.coach.notes.create({
    scope: "daily",
    localDate: today,
    text: "Five days in and steady. One focused block today keeps the streak alive.",
    modelProvider: "fake",
    modelId: "seed",
    evidenceJson: { generatedForLocalDate: today, items: [] },
    stalenessKey: "seed:today",
  });

  console.log(`seeded dev db at ${DB_URL} for ${today} (arc ${arc.id})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
