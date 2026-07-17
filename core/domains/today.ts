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
export type TodayState = "new-user" | "nothing-planned" | "fresh" | "mid-arc" | "all-done";

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

export interface TodayView {
  localDate: string;
  stat: TodayStat;
  coachLine: string | null;
  /** The single active card (NEXT UP), or null when nothing is actionable. */
  nextUp: TodayItem | null;
  laterToday: TodayItem[];
  completed: TodayItem[];
  state: TodayState;
  domains: readonly TodayDomain[];
}

export interface TodayInput {
  localDate: string;
  items: readonly PlanItemRecord[];
  progress: readonly DomainProgressRecord[];
  arcs: readonly PlanArcRecord[];
  coachNote: CoachNoteRecord | null;
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

  let state: TodayState;
  if (input.arcs.length === 0) state = "new-user";
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
    domains: TODAY_DOMAINS,
  };
}
