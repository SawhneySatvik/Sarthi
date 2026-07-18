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

  // ── Habits slice (SAR-009 D-G): rule-free habits with a grace-gapped log history so
  // the streak flames + month heatmap render (including hollow grace rings on bridged
  // misses), plus one satisfied-by habit ("Water", target 2,000 ml = its water ≥ 2,000 ml rule) whose live metric
  // reads unsatisfied by default (only 900 ml today) and flips to a ⚡-done state under
  // SEED_STATE=alldone (a second water log pushes the day over 2,000 ml + a materialized
  // source:"satisfied-by" log, exactly what the commit transaction writes at runtime).
  const seededHabits = await repos.habits.habits.list({});
  const wakeHabit = seededHabits.find((h) => h.name.toLowerCase() === "wake by 5:30 am")!;
  const meditateHabit = await repos.habits.habits.create({ name: "Meditate", cadence: "daily", difficulty: "easy", targetValue: 10, targetUnit: "minutes", isArchived: false });
  const noSugarHabit = await repos.habits.habits.create({ name: "No sugar", cadence: "daily", difficulty: "hard", targetValue: null, targetUnit: null, isArchived: false });
  const waterHabit = await repos.habits.habits.create({ name: "Water", cadence: "daily", difficulty: "medium", targetValue: 2000, targetUnit: "ml", isArchived: false });
  await repos.habits.satisfactionRules.create({
    habitId: waterHabit.id, sourceDomain: "health", sourceKind: "water", aggregateField: "millilitres", minimumValue: 2000, unit: "ml",
  });

  const habitLog = (habitId: string, delta: number) => {
    const d = isoDaysFromToday(delta);
    return repos.habits.logs.create({ habitId, occurredAt: `${d}T07:00:00.000Z`, localDate: d, timezone: "UTC", status: "done", source: "manual", note: null });
  };
  // Global active days = {0,-1,-3,-4,-6,-8}; the empty -2/-5/-7 days sit between active
  // neighbours ≤ GRACE_DAYS+1 apart → each renders a hollow grace ring, not a gap.
  for (const delta of [0, -1, -3, -4, -6, -8]) await habitLog(meditateHabit.id, delta);
  for (const delta of [0, -1, -3, -4]) await habitLog(noSugarHabit.id, delta);
  for (const delta of [-1, -3, -6, -8]) await habitLog(wakeHabit.id, delta); // unlogged today → a tickable rule-free row
  if (done) {
    // alldone: cross the 2,000 ml threshold and materialize the satisfied-by completion.
    await repos.health.waterLogs.create({ occurredAt: `${today}T15:00:00.000Z`, localDate: today, timezone: "UTC", millilitres: 1400, source: "capture", confidenceBps: 9500, estimated: false });
    await repos.habits.logs.create({ habitId: waterHabit.id, occurredAt: `${today}T15:00:00.000Z`, localDate: today, timezone: "UTC", status: "done", source: "satisfied-by", note: null });
  }

  // ── Money slice (SAR-008 D-F): a hand-checkable current-month ledger so the Money lens
  // renders real content (not Day-1 empty). Integer paise only. Food ≈78%, Transport 95% (warn bar).
  const [yy, mm] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${yy}-${pad(mm)}-01`;
  const monthEnd = `${yy}-${pad(mm)}-${pad(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`;
  const nextMonthFirst = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${pad(mm + 1)}-01`;
  // A second in-month date (yesterday, unless today is the 1st) and a future in-month date for rules.
  const earlier = Number(today.slice(8, 10)) > 1 ? isoDaysFromToday(-1) : today;
  const aheadInMonth = (delta: number): string => {
    const target = isoDaysFromToday(delta);
    return target > today && target <= monthEnd ? target : monthEnd;
  };

  const moneyCats = await repos.money.categories.list({});
  const foodCat = moneyCats.find((c) => c.name.toLowerCase() === "food & dining")!;
  const transportCat = await repos.money.categories.create({ name: "Transport", kind: "expense", colorKey: null, isSystem: false });
  const rentCat = await repos.money.categories.create({ name: "Rent", kind: "expense", colorKey: null, isSystem: false });
  const salaryCat = await repos.money.categories.create({ name: "Salary", kind: "income", colorKey: null, isSystem: false });

  const salaryRule = await repos.money.recurringRules.create({
    direction: "credit", amountPaise: 12000000, categoryId: salaryCat.id, merchant: "Acme Payroll", cadence: "monthly", nextPostDate: nextMonthFirst, isPaused: false,
  });
  await repos.money.recurringRules.create({
    direction: "debit", amountPaise: 2500000, categoryId: rentCat.id, merchant: "Rent", cadence: "monthly", nextPostDate: aheadInMonth(3), isPaused: false,
  });
  await repos.money.recurringRules.create({
    direction: "debit", amountPaise: 11900, categoryId: null, merchant: "Spotify", cadence: "monthly", nextPostDate: aheadInMonth(5), isPaused: false,
  });

  const tx = (over: Partial<Parameters<typeof repos.money.transactions.create>[0]>) =>
    repos.money.transactions.create({
      occurredAt: `${today}T12:00:00.000Z`, localDate: today, timezone: "UTC",
      direction: "debit", amountPaise: 0, categoryId: null, merchant: null, note: null,
      source: "capture", confidenceBps: 9000, estimated: false, evidenceId: null, recurringRuleId: null,
      ...over,
    });
  // Salary posted this month (credit, links the shelf chip's ↻).
  await tx({ direction: "credit", amountPaise: 12000000, categoryId: salaryCat.id, merchant: "Acme Payroll", localDate: earlier, occurredAt: `${earlier}T09:00:00.000Z`, recurringRuleId: salaryRule.id });
  // Food & dining → 6,240 of the 8,000 budget (78%).
  await tx({ amountPaise: 34000, categoryId: foodCat.id, merchant: "Lunch", occurredAt: `${today}T13:00:00.000Z` });
  await tx({ amountPaise: 52000, categoryId: foodCat.id, merchant: "Swiggy dinner", estimated: true, confidenceBps: 6200, occurredAt: `${today}T20:30:00.000Z` });
  await tx({ amountPaise: 538000, categoryId: foodCat.id, merchant: "BigBasket", localDate: earlier, occurredAt: `${earlier}T18:00:00.000Z` });
  // Transport → 1,900 of 2,000 (95% → warn bar).
  await tx({ amountPaise: 190000, categoryId: transportCat.id, merchant: "Uber", occurredAt: `${today}T08:15:00.000Z` });
  // One uncategorized debit (nullable categoryId → Uncategorized bucket).
  await tx({ amountPaise: 25000, categoryId: null, note: "Chai + snacks", occurredAt: `${today}T16:00:00.000Z` });

  await repos.money.budgets.create({ categoryId: foodCat.id, periodStart: monthStart, periodEnd: monthEnd, limitPaise: 800000 });
  await repos.money.budgets.create({ categoryId: transportCat.id, periodStart: monthStart, periodEnd: monthEnd, limitPaise: 200000 });

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
