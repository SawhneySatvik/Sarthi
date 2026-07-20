/**
 * core/domains/today.ts — SAR-005 (D-F / D-039). The pure, framework-clean Today
 * read-model. Turns raw scoped-repository records into a `TodayView` the screen
 * renders verbatim: grouping into NEXT UP / LATER / COMPLETED, the header stat
 * cluster (Day N of M · streak · level), and `via capture` provenance flags.
 *
 * Deterministic + integer-safe + NO framework/DB import (invariant #9): the Server
 * Component reads repos and calls this; there is no logic in the view. Imports only
 * `@/core/game` (a sibling) and type-only record shapes from the drizzle-free
 * `@/data/schema/contract` DTO edge (the same edge `core/contracts` uses).
 */
import { toDayNumber } from "@/core/game";
import type {
  CoachNoteRecord,
  DomainProgressRecord,
  PlanArcRecord,
  PlanItemRecord,
} from "@/data/schema/contract";

export type TodayDomain = "health" | "money" | "habits" | "skills";
export const TODAY_DOMAINS: readonly TodayDomain[] = ["health", "money", "habits", "skills"];

/** Day-state of the Today spine (drives which SCREEN-TODAY layout renders). */
export type TodayState = "new-user" | "arc-complete" | "nothing-planned" | "fresh" | "mid-arc" | "all-done";

/**
 * UIE-0e (D-053(c)) — the read-only windows that gate the arc-complete surfaces. Both are
 * integer day-counts (invariant #2), measured from a `complete` arc's `endDate` to the local
 * day via `toDayNumber`. A month-old "congrats" is stale, not calm, so the full state expires
 * after a week; the settled banner (mixed case) fades faster since a live arc holds the stage.
 */
export const ARC_COMPLETE_WINDOW_DAYS = 7;
export const ARC_SETTLED_WINDOW_DAYS = 3;

export interface TodayStat {
  /** Current day within the active arc ("Day N"), or null when there is no arc. */
  dayOfArc: number | null;
  /** Inclusive arc length ("of M"), or null for an open-ended / absent arc. */
  arcLength: number | null;
  /** Best active streak across the four real domains (amber). */
  streak: number;
  /** Overall level + XP (from the `overall` progress row; defaults 1 / 0). */
  level: number;
  xp: number;
}

export interface TodayItem {
  id: string;
  domain: PlanItemRecord["domain"];
  kind: PlanItemRecord["kind"];
  title: string;
  status: PlanItemRecord["status"];
  targetValue: number | null;
  targetUnit: string | null;
  completionSource: PlanItemRecord["completionSource"];
  /** True when the item was auto-checked by a capture commit (display only). */
  viaCapture: boolean;
}

/**
 * UIE-0e — a pure, integer-only summary of one *completed* arc, computed from the arc's own
 * history rows (not `domain_progress`, which is a cumulative rollup with no per-arc snapshot).
 * Everything here is a true, derivable number: no fabricated per-arc XP delta (invariant #1
 * ask-don't-invent) — current standing is carried separately by `TodayView.stat`.
 */
export interface ArcCompleteSummary {
  title: string;
  domain: PlanArcRecord["domain"];
  startDate: string;
  endDate: string;
  /** Inclusive arc length in days ("Day M of M"). */
  lengthDays: number;
  /** Distinct local days with at least one `done` item — "showed up N days". */
  daysEngaged: number;
  tasksDone: number;
  tasksMissed: number;
  tasksTotal: number;
  /** Done-count per real domain (excludes `overall`); zero-filled. */
  perDomainDone: Record<TodayDomain, number>;
}

export interface TodayView {
  localDate: string;
  stat: TodayStat;
  coachLine: string | null;
  /** The single active card (NEXT UP), or null when nothing is actionable. */
  nextUp: TodayItem | null;
  laterToday: TodayItem[];
  completed: TodayItem[];
  state: TodayState;
  /** UIE-0e S1: the celebration payload when `state === 'arc-complete'`, else null. */
  arcComplete: ArcCompleteSummary | null;
  /** UIE-0e S2: a compact "arc settled" banner rides atop the spine while a live arc runs. */
  settledArc: ArcCompleteSummary | null;
  domains: readonly TodayDomain[];
}

export interface TodayInput {
  localDate: string;
  items: readonly PlanItemRecord[];
  progress: readonly DomainProgressRecord[];
  arcs: readonly PlanArcRecord[];
  coachNote: CoachNoteRecord | null;
  /** UIE-0e: all plan items for any in-window `complete` arc (one bounded extra read per arc,
   *  fetched only when a completed arc exists). Absent → no arc-complete surface can build. */
  arcHistoryItems?: readonly PlanItemRecord[];
}

const ACTIONABLE_STATUS = new Set<PlanItemRecord["status"]>(["pending", "active"]);

function toItem(record: PlanItemRecord): TodayItem {
  return {
    id: record.id,
    domain: record.domain,
    kind: record.kind,
    title: record.title,
    status: record.status,
    targetValue: record.targetValue,
    targetUnit: record.targetUnit,
    completionSource: record.completionSource,
    viaCapture: record.completionSource === "capture",
  };
}

/** Active items surface before pending; then earliest dueAt (nulls last); then title. */
function actionableOrder(a: PlanItemRecord, b: PlanItemRecord): number {
  if (a.status !== b.status) return a.status === "active" ? -1 : 1;
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return a.dueAt < b.dueAt ? -1 : 1;
  }
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

/** The best current streak across the four real domains ('overall' is excluded). */
function bestActiveStreak(progress: readonly DomainProgressRecord[]): number {
  let best = 0;
  for (const row of progress) {
    if (row.domain === "overall") continue;
    if (row.streak > best) best = row.streak;
  }
  return best;
}

/** The arc that drives the "Day N of M" header: prefer the overall arc, else the earliest active one. */
function selectArc(arcs: readonly PlanArcRecord[]): PlanArcRecord | null {
  const active = arcs.filter((arc) => arc.status === "active");
  if (active.length === 0) return null;
  const overall = active.find((arc) => arc.domain === "overall");
  if (overall) return overall;
  return active
    .slice()
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))[0];
}

function arcLength(arc: PlanArcRecord): number | null {
  if (arc.endDate === null) return null;
  return toDayNumber(arc.endDate) - toDayNumber(arc.startDate) + 1;
}

/**
 * The identity-header pair (T2) — the Settings sheet's "Day N · Level L" summary. Reuses the
 * SAME `selectArc` + overall-progress rollup that `buildTodayView` (`view.stat`) and the Stats
 * wall (`view.overall`) render, so the three surfaces can never contradict. `dayOfArc` is null
 * when no active arc holds the spine; `level` defaults to 1 (a Day-1 user, never level zero).
 * A pure projection — no clock read, no framework/DB import (invariant #9).
 */
export interface TodayIdentity {
  dayOfArc: number | null;
  level: number;
}

export function buildIdentity(input: {
  progress: readonly DomainProgressRecord[];
  arcs: readonly PlanArcRecord[];
}): TodayIdentity {
  const overall = input.progress.find((row) => row.domain === "overall") ?? null;
  const arc = selectArc(input.arcs);
  return { dayOfArc: arc ? arc.dayNumber : null, level: overall ? overall.level : 1 };
}

/** Whole days from a `complete` arc's `endDate` up to `localDate` (integer, non-negative). */
function daysSinceEnd(endDate: string, localDate: string): number {
  return toDayNumber(localDate) - toDayNumber(endDate);
}

/**
 * The latest `complete` arc within `windowDays` of today, or null. Open-ended arcs never
 * complete via rollover, so an in-window completion always has an `endDate`. Latest wins;
 * older completions belong to Journey.
 */
function latestCompletedArc(
  arcs: readonly PlanArcRecord[],
  localDate: string,
  windowDays: number,
): PlanArcRecord | null {
  let best: PlanArcRecord | null = null;
  for (const arc of arcs) {
    if (arc.status !== "complete" || arc.endDate === null) continue;
    const since = daysSinceEnd(arc.endDate, localDate);
    if (since < 0 || since > windowDays) continue;
    if (best === null || arc.endDate > best.endDate!) best = arc;
  }
  return best;
}

/** Pure per-arc summary from the arc's own history rows. Zero-item arcs return all-zero counts. */
function buildArcCompleteSummary(
  arc: PlanArcRecord,
  historyItems: readonly PlanItemRecord[],
): ArcCompleteSummary {
  const items = historyItems.filter((item) => item.arcId === arc.id);
  const engagedDates = new Set<string>();
  const perDomainDone: Record<TodayDomain, number> = { health: 0, money: 0, habits: 0, skills: 0 };
  let tasksDone = 0;
  let tasksMissed = 0;
  for (const item of items) {
    if (item.status === "done") {
      tasksDone += 1;
      engagedDates.add(item.localDate);
      if (item.domain !== "overall") perDomainDone[item.domain] += 1;
    } else if (item.status === "missed") {
      tasksMissed += 1;
    }
  }
  // `endDate` is non-null for a completed arc; fall back to `startDate` only defensively.
  const endDate = arc.endDate ?? arc.startDate;
  return {
    title: arc.title,
    domain: arc.domain,
    startDate: arc.startDate,
    endDate,
    lengthDays: toDayNumber(endDate) - toDayNumber(arc.startDate) + 1,
    daysEngaged: engagedDates.size,
    tasksDone,
    tasksMissed,
    tasksTotal: items.length,
    perDomainDone,
  };
}

export function buildTodayView(input: TodayInput): TodayView {
  const todays = input.items.filter((item) => item.localDate === input.localDate);
  const actionable = todays.filter((item) => ACTIONABLE_STATUS.has(item.status)).slice().sort(actionableOrder);
  const completed = todays.filter((item) => !ACTIONABLE_STATUS.has(item.status));

  const overall = input.progress.find((row) => row.domain === "overall") ?? null;
  const arc = selectArc(input.arcs);

  const stat: TodayStat = {
    dayOfArc: arc ? arc.dayNumber : null,
    arcLength: arc ? arcLength(arc) : null,
    streak: bestActiveStreak(input.progress),
    level: overall ? overall.level : 1,
    xp: overall ? overall.xp : 0,
  };

  // UIE-0e (§11.2). S1 full celebration: no active arc + nothing planned today + a fresh
  // completion within the 7-day window. S2 settled banner: a live arc still holds the spine,
  // but a recent completion (3-day window) is acknowledged above it. The two are mutually
  // exclusive (S1 requires no active arc; S2 requires one), computed from the same history.
  const history = input.arcHistoryItems ?? [];
  const hasActiveArc = input.arcs.some((a) => a.status === "active");
  const fullArc = latestCompletedArc(input.arcs, input.localDate, ARC_COMPLETE_WINDOW_DAYS);
  const bannerArc = latestCompletedArc(input.arcs, input.localDate, ARC_SETTLED_WINDOW_DAYS);

  const isArcComplete = !hasActiveArc && todays.length === 0 && fullArc !== null;
  const arcComplete = isArcComplete ? buildArcCompleteSummary(fullArc!, history) : null;
  const settledArc = hasActiveArc && bannerArc !== null ? buildArcCompleteSummary(bannerArc, history) : null;

  let state: TodayState;
  if (input.arcs.length === 0) state = "new-user";
  else if (isArcComplete) state = "arc-complete";
  else if (todays.length === 0) state = "nothing-planned";
  else if (actionable.length === 0) state = "all-done";
  else if (completed.length === 0) state = "fresh";
  else state = "mid-arc";

  return {
    localDate: input.localDate,
    stat,
    coachLine: input.coachNote ? input.coachNote.text : null,
    nextUp: actionable.length > 0 ? toItem(actionable[0]) : null,
    laterToday: actionable.slice(1).map(toItem),
    completed: completed.map(toItem),
    state,
    arcComplete,
    settledArc,
    domains: TODAY_DOMAINS,
  };
}
