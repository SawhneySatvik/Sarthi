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
