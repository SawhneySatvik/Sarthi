/**
 * tests/habits-view.test.ts — SAR-009 (D-H). The pure Habits lens read-model +
 * `planManualTick` toggle decision + `resolveRuleDayTotals`. Keyless. Proves:
 * grace-aware per-habit streaks (reused game kernel), headline counts, heatmap
 * fractions + the grace-ring predicate, manual/satisfied-by discrimination on
 * `source`, `ruleHint` text, the water-kind live aggregate, archived exclusion, and
 * the D-A manual-tick boundary (refuse rule-bearing / satisfied-by; create/update/
 * no-op round-trips — never a delete).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHabitsView,
  executeManualTick,
  planManualTick,
  resolveRuleDayTotals,
  ruleHint,
} from "../core/domains/habits";
import type { UserScopedRepositories } from "../core/contracts";
import { createRepositoryFactory } from "../data/repository";
import type {
  HabitLogRecord,
  HabitRecord,
  HabitSatisfactionRuleRecord,
} from "../data/schema/contract";
import { createMemoryDb } from "./helpers/memory-db";

const TODAY = "2026-07-18";
const BASE = { userId: "local-dev", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", deletedAt: null };

function habit(over: Partial<HabitRecord> & { id: string }): HabitRecord {
  return {
    ...BASE,
    name: over.id,
    cadence: "daily",
    difficulty: "medium",
    targetValue: null,
    targetUnit: null,
    isArchived: false,
    ...over,
  } as HabitRecord;
}

function log(over: Partial<HabitLogRecord> & { id: string; habitId: string; localDate: string }): HabitLogRecord {
  return {
    ...BASE,
    occurredAt: `${over.localDate}T08:00:00.000Z`,
    timezone: "UTC",
    status: "done",
    source: "manual",
    note: null,
    ...over,
  } as HabitLogRecord;
}

function rule(over: Partial<HabitSatisfactionRuleRecord> & { id: string; habitId: string }): HabitSatisfactionRuleRecord {
  return {
    ...BASE,
    sourceDomain: "health",
    sourceKind: "water",
    aggregateField: "millilitres",
    minimumValue: 2000,
    unit: "ml",
    ...over,
  } as HabitSatisfactionRuleRecord;
}

const noTotals = new Map<string, number | null>();

function rowFor(view: ReturnType<typeof buildHabitsView>, habitId: string) {
  const r = view.rows.find((x) => x.habitId === habitId);
  assert.ok(r, `row for ${habitId}`);
  return r!;
}

function heatDay(view: ReturnType<typeof buildHabitsView>, localDate: string) {
  for (const week of view.heatmap.weeks) {
    for (const day of week) {
      if (day && day.localDate === localDate) return day;
    }
  }
  throw new Error(`no heatmap day ${localDate}`);
}

test("per-habit streak is grace-aware via the reused kernel; a one-day gap bridges", () => {
  const view = buildHabitsView({
    localDate: TODAY,
    habits: [habit({ id: "h" })],
    logs: [
      log({ id: "l1", habitId: "h", localDate: "2026-07-18" }),
      log({ id: "l2", habitId: "h", localDate: "2026-07-17" }),
      // 2026-07-16 missed (no log) — bridged by grace
      log({ id: "l3", habitId: "h", localDate: "2026-07-15" }),
    ],
    rules: [],
    ruleTotals: noTotals,
  });
  assert.equal(rowFor(view, "h").streak, 3);
});

test("skipped logs are NOT streak-active (grace may still bridge the gap)", () => {
  const view = buildHabitsView({
    localDate: TODAY,
    habits: [habit({ id: "h" })],
    logs: [
      log({ id: "l1", habitId: "h", localDate: "2026-07-18", status: "done" }),
      log({ id: "l2", habitId: "h", localDate: "2026-07-17", status: "skipped" }),
    ],
    rules: [],
    ruleTotals: noTotals,
  });
  // Only today is active → streak 1 (skipped yesterday does not extend it).
  assert.equal(rowFor(view, "h").streak, 1);
});

test("headline counts strict done; today status + source bucket are discriminated", () => {
  const view = buildHabitsView({
    localDate: TODAY,
    habits: [
      habit({ id: "a", name: "Meditate", createdAt: "2026-07-01T00:00:00.000Z" }),
      habit({ id: "b", name: "No sugar", createdAt: "2026-07-02T00:00:00.000Z" }),
      habit({ id: "c", name: "Water 3L", createdAt: "2026-07-03T00:00:00.000Z" }),
    ],
    logs: [
      log({ id: "la", habitId: "a", localDate: TODAY, status: "done", source: "manual" }),
      log({ id: "lc", habitId: "c", localDate: TODAY, status: "done", source: "satisfied-by" }),
      // b unlogged today
    ],
    rules: [],
    ruleTotals: noTotals,
  });
  assert.deepEqual(view.headline, { done: 2, total: 3 });
  assert.equal(view.rows.map((r) => r.habitId).join(","), "a,b,c"); // seed order
  assert.equal(rowFor(view, "a").source, "manual");
  assert.equal(rowFor(view, "a").today, "done");
  assert.equal(rowFor(view, "c").source, "satisfied-by");
  assert.equal(rowFor(view, "b").today, "unlogged");
  assert.equal(rowFor(view, "b").source, null);
});

test("capture-sourced today log folds into the 'manual' display bucket", () => {
  const view = buildHabitsView({
    localDate: TODAY,
    habits: [habit({ id: "h" })],
    logs: [log({ id: "l", habitId: "h", localDate: TODAY, status: "done", source: "capture" })],
    rules: [],
    ruleTotals: noTotals,
  });
  assert.equal(rowFor(view, "h").source, "manual");
});

test("satisfiedBy is non-null iff the habit has a rule; carries hint + live total + target", () => {
  const view = buildHabitsView({
    localDate: TODAY,
    habits: [
      habit({ id: "free" }),
      habit({ id: "rb", name: "Water 3L", targetValue: 3000, targetUnit: "ml" }),
    ],
    logs: [],
    rules: [rule({ id: "r1", habitId: "rb" })],
    ruleTotals: new Map([["r1", 900]]),
  });
  assert.equal(rowFor(view, "free").satisfiedBy, null);
  const sb = rowFor(view, "rb").satisfiedBy;
  assert.ok(sb);
  assert.equal(sb!.sourceDomain, "health");
  assert.equal(sb!.todayTotal, 900);
  assert.equal(sb!.targetValue, 3000);
  assert.equal(sb!.targetUnit, "ml");
  assert.equal(sb!.hint, "Satisfies itself from Health — water ≥ 2,000 ml");
});

test("ruleHint composes the glass-box rule text from the rule columns", () => {
  assert.equal(
    ruleHint(rule({ id: "r", habitId: "h" })),
    "Satisfies itself from Health — water ≥ 2,000 ml",
  );
});

test("archived habits are excluded from rows, headline, and heatmap denominators", () => {
  const view = buildHabitsView({
    localDate: TODAY,
    habits: [
      habit({ id: "live" }),
      habit({ id: "dead", isArchived: true }),
    ],
    logs: [log({ id: "l", habitId: "live", localDate: TODAY, status: "done" })],
    rules: [],
    ruleTotals: noTotals,
  });
  assert.equal(view.rows.length, 1);
  assert.deepEqual(view.headline, { done: 1, total: 1 });
  assert.equal(heatDay(view, TODAY).total, 1);
});

test("heatmap: fraction = done/total; a bridged single-day gap is a grace ring, a trailing gap is not", () => {
  const view = buildHabitsView({
    localDate: TODAY,
    habits: [habit({ id: "a" }), habit({ id: "b" })],
    logs: [
      log({ id: "1", habitId: "a", localDate: "2026-07-10", status: "done" }),
      log({ id: "2", habitId: "b", localDate: "2026-07-10", status: "done" }),
      log({ id: "3", habitId: "a", localDate: "2026-07-11", status: "done" }),
      // 2026-07-12 empty, bridged by 11 and 13 (gap 2 = GRACE_DAYS + 1)
      log({ id: "4", habitId: "a", localDate: "2026-07-13", status: "done" }),
      // 2026-07-14+ empty — trailing gap, no future active day → not grace
    ],
    rules: [],
    ruleTotals: noTotals,
  });
  assert.equal(heatDay(view, "2026-07-10").fraction, 1); // 2 of 2
  assert.equal(heatDay(view, "2026-07-11").fraction, 0.5); // 1 of 2
  assert.equal(heatDay(view, "2026-07-12").fraction, 0);
  assert.equal(heatDay(view, "2026-07-12").grace, true); // bridged
  assert.equal(heatDay(view, "2026-07-14").grace, false); // trailing gap
  assert.equal(heatDay(view, "2026-07-10").doneCount, 2);
});

test("heatmap weeks are Monday-start and fully padded to 7-cell rows", () => {
  const view = buildHabitsView({ localDate: TODAY, habits: [habit({ id: "a" })], logs: [], rules: [], ruleTotals: noTotals });
  for (const week of view.heatmap.weeks) assert.equal(week.length, 7);
  // 2026-07-01 is a Wednesday → 2 leading pad cells (Mon, Tue).
  assert.deepEqual(view.heatmap.weeks[0].slice(0, 2), [null, null]);
  assert.equal(view.heatmap.weeks[0][2]?.dayOfMonth, 1);
});

test("resolveRuleDayTotals sums the water source for today; unknown kind → null", async () => {
  const waterRows = [
    { localDate: TODAY, millilitres: 900 },
    { localDate: TODAY, millilitres: 1300 },
    { localDate: "2026-07-17", millilitres: 500 },
  ];
  const repos = {
    health: { waterLogs: { list: async () => waterRows } },
  } as unknown as UserScopedRepositories;

  const totals = await resolveRuleDayTotals(
    repos,
    [rule({ id: "r1", habitId: "h" }), rule({ id: "r2", habitId: "h2", sourceKind: "bogus" })],
    TODAY,
  );
  assert.equal(totals.get("r1"), 2200); // 900 + 1300, 17th excluded
  assert.equal(totals.get("r2"), null); // unknown kind
});

test("planManualTick: rule-bearing and satisfied-by rows REFUSE", () => {
  assert.deepEqual(planManualTick({ todayRow: null, hasActiveRules: true, next: "done" }), { op: "refuse" });
  const satisfied = log({ id: "s", habitId: "h", localDate: TODAY, status: "done", source: "satisfied-by" });
  assert.deepEqual(planManualTick({ todayRow: satisfied, hasActiveRules: false, next: "clear" }), { op: "refuse" });
});

test("planManualTick: rule-free create / update round-trips in place, never a delete; clear-without-row no-ops", () => {
  // Empty day, tick → create done.
  assert.deepEqual(planManualTick({ todayRow: null, hasActiveRules: false, next: "done" }), { op: "create", status: "done" });
  // Live row, tick → in-place update to done.
  const row = log({ id: "l1", habitId: "h", localDate: TODAY, status: "skipped", source: "manual" });
  assert.deepEqual(planManualTick({ todayRow: row, hasActiveRules: false, next: "done" }), {
    op: "update",
    id: "l1",
    patch: { status: "done", source: "manual" },
  });
  // Live row, clear → in-place update to skipped (NOT a delete).
  const done = log({ id: "l2", habitId: "h", localDate: TODAY, status: "done", source: "manual" });
  assert.deepEqual(planManualTick({ todayRow: done, hasActiveRules: false, next: "clear" }), {
    op: "update",
    id: "l2",
    patch: { status: "skipped", source: "manual" },
  });
  // No row, clear → no-op.
  assert.deepEqual(planManualTick({ todayRow: null, hasActiveRules: false, next: "clear" }), { op: "noop" });
});

// ── DB-level proof of the write path against real SQLite (the unique-index / tombstone
// risk the pure `planManualTick` cannot exercise). Keyless: the fixture applies the
// committed migrations to an isolated libSQL file and never touches the network.
const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const NOW = "2026-07-18T05:20:00.000Z";

async function scopedRepos(): Promise<UserScopedRepositories> {
  const { db } = await createMemoryDb();
  return createRepositoryFactory(db).forUser(LOCAL);
}

test("executeManualTick round-trips a rule-free habit in place: create → clear → done, one live row, id stable, never deleted", async () => {
  const repos = await scopedRepos();
  const h = await repos.habits.habits.create({ name: "Evening walk", cadence: "daily", difficulty: "easy", targetValue: null, targetUnit: null, isArchived: false });
  const localDate = NOW.slice(0, 10);
  const live = async () => repos.habits.logs.list({ habitId: h.id, localDate });

  // create (empty day → done)
  assert.deepEqual(await executeManualTick(repos, h.id, "done", NOW), { op: "create", status: "done" });
  let rows = await live();
  assert.equal(rows.length, 1);
  const rowId = rows[0].id;
  assert.equal(rows[0].status, "done");
  assert.equal(rows[0].source, "manual");
  assert.equal(rows[0].deletedAt, null);

  // clear (in-place update to skipped — NOT a soft-delete)
  assert.deepEqual(await executeManualTick(repos, h.id, "clear", NOW), {
    op: "update",
    id: rowId,
    patch: { status: "skipped", source: "manual" },
  });
  rows = await live();
  assert.equal(rows.length, 1, "still exactly one live row after clear");
  assert.equal(rows[0].id, rowId, "same row id — toggled in place");
  assert.equal(rows[0].status, "skipped");
  assert.equal(rows[0].deletedAt, null, "clear never soft-deletes");

  // re-tick same day (no unique-index collision — proves the in-place design)
  assert.deepEqual(await executeManualTick(repos, h.id, "done", NOW), {
    op: "update",
    id: rowId,
    patch: { status: "done", source: "manual" },
  });
  rows = await live();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, rowId);
  assert.equal(rows[0].status, "done");
});

test("executeManualTick REFUSES a rule-bearing habit server-side and writes nothing", async () => {
  const repos = await scopedRepos();
  const h = await repos.habits.habits.create({ name: "Water 3L", cadence: "daily", difficulty: "medium", targetValue: 3000, targetUnit: "ml", isArchived: false });
  await repos.habits.satisfactionRules.create({ habitId: h.id, sourceDomain: "health", sourceKind: "water", aggregateField: "millilitres", minimumValue: 2000, unit: "ml" });

  await assert.rejects(() => executeManualTick(repos, h.id, "done", NOW), /refused/);
  const rows = await repos.habits.logs.list({ habitId: h.id, localDate: NOW.slice(0, 10) });
  assert.equal(rows.length, 0, "no habit_log written for a rule-bearing habit");
});
