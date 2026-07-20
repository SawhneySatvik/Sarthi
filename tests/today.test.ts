/**
 * tests/today.test.ts — the pure Today read-model (SAR-005, D-F). Keyless, no DB.
 * Proves grouping (NEXT UP = exactly one), Day N of M, best-active-streak (excludes
 * 'overall'), via-capture flagging, day-state selection, and safe defaults.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildTodayView, TODAY_DOMAINS } from "../core/domains/today";
import type {
  CoachNoteRecord,
  DomainProgressRecord,
  PlanArcRecord,
  PlanItemRecord,
} from "../data/schema/contract";

const DAY = "2026-07-18";
const BASE = {
  id: "",
  userId: "local-dev",
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z",
  deletedAt: null,
};

function item(over: Partial<PlanItemRecord> & { id: string }): PlanItemRecord {
  return {
    ...BASE,
    arcId: "arc-1",
    domain: "health",
    kind: "task",
    title: "Item",
    dueAt: null,
    localDate: DAY,
    targetValue: null,
    targetUnit: null,
    status: "active",
    completionSource: null,
    ruleJson: null,
    linkedHabitId: null,
    linkedSkillId: null,
    ...over,
  } as PlanItemRecord;
}

function progress(over: Partial<DomainProgressRecord> & { domain: DomainProgressRecord["domain"] }): DomainProgressRecord {
  return {
    ...BASE,
    id: `p-${over.domain}`,
    xp: 0,
    level: 1,
    streak: 0,
    bestStreak: 0,
    cumulativeMinutes: 0,
    lastActiveDate: null,
    ...over,
  } as DomainProgressRecord;
}

function arc(over: Partial<PlanArcRecord> & { id: string }): PlanArcRecord {
  return {
    ...BASE,
    domain: "overall",
    mode: "build",
    title: "Arc",
    startDate: "2026-07-14",
    endDate: null,
    dayNumber: 1,
    status: "active",
    ...over,
  } as PlanArcRecord;
}

const NO_COACH: CoachNoteRecord | null = null;

test("groups into NEXT UP (exactly one) / LATER / COMPLETED; active surfaces first", () => {
  const view = buildTodayView({
    localDate: DAY,
    items: [
      item({ id: "a", status: "pending", title: "Pending A" }),
      item({ id: "b", status: "active", title: "Active B" }),
      item({ id: "c", status: "done", title: "Done C", completionSource: "manual" }),
    ],
    progress: [],
    arcs: [arc({ id: "arc-1" })],
    coachNote: NO_COACH,
  });
  assert.ok(view.nextUp);
  assert.equal(view.nextUp?.id, "b"); // active before pending
  assert.equal(view.laterToday.length, 1);
  assert.equal(view.laterToday[0].id, "a");
  assert.equal(view.completed.length, 1);
  assert.equal(view.completed[0].id, "c");
  assert.equal(view.state, "mid-arc");
  assert.deepEqual([...view.domains], [...TODAY_DOMAINS]);
});

test("Day N of M: arcLength is inclusive of both endpoints; dayOfArc = dayNumber", () => {
  const view = buildTodayView({
    localDate: DAY,
    items: [item({ id: "a" })],
    progress: [],
    arcs: [arc({ id: "arc-1", startDate: "2026-07-14", endDate: "2026-08-12", dayNumber: 5 })],
    coachNote: NO_COACH,
  });
  assert.equal(view.stat.dayOfArc, 5);
  assert.equal(view.stat.arcLength, 30); // 07-14 .. 08-12 inclusive
});

test("open-ended arc has null arcLength; no arc leaves both null", () => {
  const open = buildTodayView({ localDate: DAY, items: [item({ id: "a" })], progress: [], arcs: [arc({ id: "arc-1", endDate: null })], coachNote: NO_COACH });
  assert.equal(open.stat.arcLength, null);
  assert.equal(open.stat.dayOfArc, 1);
});

test("streak = best across the four real domains; 'overall' is excluded", () => {
  const view = buildTodayView({
    localDate: DAY,
    items: [item({ id: "a" })],
    progress: [
      progress({ domain: "overall", streak: 99, level: 4, xp: 1200 }),
      progress({ domain: "health", streak: 3 }),
      progress({ domain: "skills", streak: 7 }),
    ],
    arcs: [arc({ id: "arc-1" })],
    coachNote: NO_COACH,
  });
  assert.equal(view.stat.streak, 7); // not 99 (overall excluded)
  assert.equal(view.stat.level, 4); // overall level
  assert.equal(view.stat.xp, 1200);
});

test("via-capture flag mirrors completionSource === 'capture'", () => {
  const view = buildTodayView({
    localDate: DAY,
    items: [
      item({ id: "cap", status: "done", completionSource: "capture" }),
      item({ id: "man", status: "done", completionSource: "manual" }),
    ],
    progress: [],
    arcs: [arc({ id: "arc-1" })],
    coachNote: NO_COACH,
  });
  const cap = view.completed.find((i) => i.id === "cap");
  const man = view.completed.find((i) => i.id === "man");
  assert.equal(cap?.viaCapture, true);
  assert.equal(man?.viaCapture, false);
});

test("no overall progress row → level 1 / xp 0 defaults; coach line passes through", () => {
  const note = { text: "One steady morning." } as CoachNoteRecord;
  const view = buildTodayView({ localDate: DAY, items: [item({ id: "a" })], progress: [], arcs: [arc({ id: "arc-1" })], coachNote: note });
  assert.equal(view.stat.level, 1);
  assert.equal(view.stat.xp, 0);
  assert.equal(view.coachLine, "One steady morning.");
});

test("day-states: new-user / nothing-planned / all-done / fresh", () => {
  const newUser = buildTodayView({ localDate: DAY, items: [], progress: [], arcs: [], coachNote: NO_COACH });
  assert.equal(newUser.state, "new-user");
  assert.equal(newUser.nextUp, null);

  const nothing = buildTodayView({ localDate: DAY, items: [item({ id: "x", localDate: "2026-07-01" })], progress: [], arcs: [arc({ id: "arc-1" })], coachNote: NO_COACH });
  assert.equal(nothing.state, "nothing-planned"); // the only item is on another day

  const allDone = buildTodayView({ localDate: DAY, items: [item({ id: "a", status: "done" }), item({ id: "b", status: "skipped" })], progress: [], arcs: [arc({ id: "arc-1" })], coachNote: NO_COACH });
  assert.equal(allDone.state, "all-done");
  assert.equal(allDone.nextUp, null);

  const fresh = buildTodayView({ localDate: DAY, items: [item({ id: "a", status: "active" })], progress: [], arcs: [arc({ id: "arc-1" })], coachNote: NO_COACH });
  assert.equal(fresh.state, "fresh");
});

// ── UIE-0e — arc-complete celebration day-state (§11.6). Read-only view derivation. ──

test("UIE-0e S1: in-window completed arc + no active arc + nothing today → arc-complete summary", () => {
  const view = buildTodayView({
    localDate: DAY, // 2026-07-18
    items: [],
    progress: [progress({ domain: "overall", level: 4, xp: 1240 }), progress({ domain: "skills", streak: 6 })],
    arcs: [arc({ id: "a1", status: "complete", startDate: "2026-06-16", endDate: "2026-07-15" })], // ended 3d ago
    coachNote: NO_COACH,
    arcHistoryItems: [
      item({ id: "h1", arcId: "a1", localDate: "2026-07-01", domain: "health", status: "done", completionSource: "manual" }),
      item({ id: "h2", arcId: "a1", localDate: "2026-07-02", domain: "skills", status: "done", completionSource: "manual" }),
      item({ id: "h3", arcId: "a1", localDate: "2026-07-03", domain: "money", status: "done", completionSource: "manual" }),
      item({ id: "h4", arcId: "a1", localDate: "2026-07-04", domain: "habits", status: "missed" }),
    ],
  });
  assert.equal(view.state, "arc-complete");
  assert.equal(view.settledArc, null);
  assert.ok(view.arcComplete);
  assert.equal(view.arcComplete?.lengthDays, 30); // Jun 16 .. Jul 15 inclusive
  assert.equal(view.arcComplete?.daysEngaged, 3); // distinct days with a `done`
  assert.equal(view.arcComplete?.tasksDone, 3);
  assert.equal(view.arcComplete?.tasksMissed, 1);
  assert.equal(view.arcComplete?.tasksTotal, 4);
  assert.equal(view.arcComplete?.perDomainDone.health, 1);
  assert.equal(view.arcComplete?.perDomainDone.skills, 1);
  assert.equal(view.arcComplete?.perDomainDone.money, 1);
  assert.equal(view.arcComplete?.perDomainDone.habits, 0);
});

test("UIE-0e S1: a completion past the 7-day window falls back to nothing-planned", () => {
  const view = buildTodayView({
    localDate: DAY,
    items: [],
    progress: [],
    arcs: [arc({ id: "a1", status: "complete", startDate: "2026-06-01", endDate: "2026-07-08" })], // 10d ago
    coachNote: NO_COACH,
    arcHistoryItems: [item({ id: "h1", arcId: "a1", localDate: "2026-07-01", status: "done", completionSource: "manual" })],
  });
  assert.equal(view.state, "nothing-planned");
  assert.equal(view.arcComplete, null);
  assert.equal(view.settledArc, null);
});

test("UIE-0e S2: a recent completion beside a live arc populates settledArc, not S1", () => {
  const view = buildTodayView({
    localDate: DAY,
    items: [item({ id: "t1", arcId: "live", status: "active" })],
    progress: [],
    arcs: [
      arc({ id: "live", status: "active", endDate: null }),
      arc({ id: "done1", status: "complete", startDate: "2026-07-01", endDate: "2026-07-16" }), // 2d ago
    ],
    coachNote: NO_COACH,
    arcHistoryItems: [
      item({ id: "h1", arcId: "done1", localDate: "2026-07-05", status: "done", completionSource: "manual" }),
      item({ id: "h2", arcId: "done1", localDate: "2026-07-06", status: "missed" }),
    ],
  });
  assert.notEqual(view.state, "arc-complete");
  assert.equal(view.arcComplete, null);
  assert.ok(view.settledArc);
  assert.equal(view.settledArc?.tasksDone, 1);
  assert.equal(view.settledArc?.tasksTotal, 2);
});

test("UIE-0e edge: an in-window completion with no history rows → arc-complete but zero counts (no fake 0 of 0)", () => {
  const view = buildTodayView({
    localDate: DAY,
    items: [],
    progress: [],
    arcs: [arc({ id: "a1", status: "complete", startDate: "2026-06-16", endDate: "2026-07-15" })],
    coachNote: NO_COACH,
    arcHistoryItems: [],
  });
  assert.equal(view.state, "arc-complete");
  assert.ok(view.arcComplete);
  assert.equal(view.arcComplete?.tasksTotal, 0);
  assert.equal(view.arcComplete?.tasksDone, 0);
  assert.equal(view.arcComplete?.daysEngaged, 0);
});

test("UIE-0e S1 requires an empty today: a materialized item today blocks the celebration", () => {
  const view = buildTodayView({
    localDate: DAY,
    items: [item({ id: "t1", arcId: "a1", status: "active" })],
    progress: [],
    arcs: [arc({ id: "a1", status: "complete", startDate: "2026-06-16", endDate: "2026-07-15" })],
    coachNote: NO_COACH,
    arcHistoryItems: [],
  });
  assert.notEqual(view.state, "arc-complete");
  assert.equal(view.arcComplete, null);
});
