/**
 * core/domains/skills.ts — SAR-010 (D-A/D-B). The pure, framework-clean Skills lens
 * read-model: the practice tracks → per-skill mastery (the hero counter), an ordered
 * curriculum, and a recent session log. Deterministic, INTEGER MINUTES end-to-end —
 * hours only ever appear via the two display formatters (`formatMastery*`), nothing
 * fractional is stored. No framework/DB import (invariant #9): type-only DTO edge, like
 * `core/domains/health.ts`; the date maths reuse the core `@/core/game` day kernel.
 *
 * ⚠ Mastery is the SUM of `skill_sessions.minutes` filtered by `skillId`, computed here
 * in memory — NEVER `domain_progress.cumulativeMinutes`, which buckets ALL skills into
 * one per-DOMAIN rollup. The repos expose no aggregate port, so the group/sum lives in
 * this read-model (mirrors `buildMoneyView`). A stored per-skill cumulative is a deferred
 * optimization (invariant #7 — comment only, no new concept, no new column).
 */
import { daysBetween } from "@/core/game";
import type { SkillMilestoneRecord, SkillRecord, SkillSessionRecord } from "@/data/schema/contract";

/** No session within this many days of the view date dims the card (display-only). */
const DORMANT_AFTER_DAYS = 14;
/** Most recent sessions surfaced in a drill's log. */
const SESSION_LOG_CAP = 10;

/** Mastery tiers in MINUTES (10h/100h/500h). Display-only treatments — never stored. */
const THRESHOLDS = [
  { hours: 500 as const, minutes: 30_000 },
  { hours: 100 as const, minutes: 6_000 },
  { hours: 10 as const, minutes: 600 },
];

export type ThresholdHours = 0 | 10 | 100 | 500;
export type NextThresholdHours = 10 | 100 | 500 | null;

/** ✓ done · ▸ current (first incomplete) · ○ upcoming. */
export type MilestoneState = "done" | "current" | "upcoming";

export interface MilestoneRow {
  id: string;
  label: string;
  sortOrder: number;
  state: MilestoneState;
  completedAt: string | null;
}

export interface SessionRow {
  id: string;
  localDate: string;
  minutes: number;
  /** capture / timer / typed / seed — surfaced as a muted source tag. */
  source: string;
  note: string | null;
  estimated: boolean;
}

export interface SkillTrack {
  id: string;
  name: string;
  /** sum(skill_sessions.minutes) for THIS skillId — integer, lifetime. NOT cumulativeMinutes. */
  masteryMinutes: number;
  targetMinutes: number | null;
  /** masteryMinutes/targetMinutes clamped [0,1]; null when there is no positive target. */
  fraction: number | null;
  /** Highest of 10/100/500h crossed — a DISPLAY tier, derived from masteryMinutes. */
  thresholdHours: ThresholdHours;
  nextThresholdHours: NextThresholdHours;
  /** By sortOrder: ✓ (completedAt≠null) · ▸ (first incomplete) · ○ (rest). */
  milestones: MilestoneRow[];
  /** occurredAt desc, then id — capped at SESSION_LOG_CAP. */
  sessions: SessionRow[];
  lastSessionLocalDate: string | null;
  /** No session within DORMANT_AFTER_DAYS of the view date (display-only dim). */
  dormant: boolean;
}

export interface SkillsView {
  /** Ordered: active first (by name), dormant last. */
  skills: SkillTrack[];
}

export interface SkillsInput {
  localDate: string;
  skills: readonly SkillRecord[];
  milestones: readonly SkillMilestoneRecord[];
  sessions: readonly SkillSessionRecord[];
}

/** Integer-safe sum: non-numeric/non-finite contributes 0 (mirrors `commit.ts` `toInt`). */
function sumMinutes(sessions: readonly SkillSessionRecord[]): number {
  let total = 0;
  for (const s of sessions) {
    if (typeof s.minutes === "number" && Number.isFinite(s.minutes)) total += s.minutes;
  }
  return total;
}

/** occurredAt desc, then id asc — a total order so a drill's log is deterministic. */
function bySessionRecency(a: SkillSessionRecord, b: SkillSessionRecord): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function highestThreshold(minutes: number): ThresholdHours {
  for (const t of THRESHOLDS) if (minutes >= t.minutes) return t.hours;
  return 0;
}

function nextThreshold(minutes: number): NextThresholdHours {
  // THRESHOLDS is high→low; the smallest tier still ABOVE the current minutes is "next".
  for (let i = THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (minutes < THRESHOLDS[i].minutes) return THRESHOLDS[i].hours;
  }
  return null;
}

/**
 * Curriculum states from `skill_milestones` (D-D): a row with `completedAt` is `done`
 * (always — a later completion never suppresses an earlier gap); the single lowest
 * unfinished `sortOrder` is `current` (▸); the rest are `upcoming`. Sorted by sortOrder,
 * then id for a stable total order.
 */
function buildMilestones(rows: readonly SkillMilestoneRecord[]): MilestoneRow[] {
  const ordered = rows
    .slice()
    .sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let currentClaimed = false;
  return ordered.map((m) => {
    let state: MilestoneState;
    if (m.completedAt !== null) {
      state = "done";
    } else if (!currentClaimed) {
      state = "current";
      currentClaimed = true;
    } else {
      state = "upcoming";
    }
    return { id: m.id, label: m.label, sortOrder: m.sortOrder, state, completedAt: m.completedAt };
  });
}

/**
 * Build the pure Skills read-model. Archived skills are excluded by the caller's
 * `isArchived:false` read; grouping/summing is an in-memory reduction over the three
 * equality-filtered arrays (no aggregate repo port). Every minute value is an integer.
 */
export function buildSkillsView(input: SkillsInput): SkillsView {
  const { localDate, skills, milestones, sessions } = input;

  const sessionsBySkill = new Map<string, SkillSessionRecord[]>();
  for (const s of sessions) {
    const bucket = sessionsBySkill.get(s.skillId);
    if (bucket) bucket.push(s);
    else sessionsBySkill.set(s.skillId, [s]);
  }
  const milestonesBySkill = new Map<string, SkillMilestoneRecord[]>();
  for (const m of milestones) {
    const bucket = milestonesBySkill.get(m.skillId);
    if (bucket) bucket.push(m);
    else milestonesBySkill.set(m.skillId, [m]);
  }

  const tracks: SkillTrack[] = skills.map((skill) => {
    const own = (sessionsBySkill.get(skill.id) ?? []).slice().sort(bySessionRecency);
    const masteryMinutes = sumMinutes(own);
    const target = skill.targetMinutes;
    const lastSessionLocalDate = own.length > 0 ? own[0].localDate : null;
    const dormant =
      lastSessionLocalDate === null || daysBetween(localDate, lastSessionLocalDate) > DORMANT_AFTER_DAYS;

    return {
      id: skill.id,
      name: skill.name,
      masteryMinutes,
      targetMinutes: target,
      fraction: target !== null && target > 0 ? Math.min(masteryMinutes / target, 1) : null,
      thresholdHours: highestThreshold(masteryMinutes),
      nextThresholdHours: nextThreshold(masteryMinutes),
      milestones: buildMilestones(milestonesBySkill.get(skill.id) ?? []),
      sessions: own.slice(0, SESSION_LOG_CAP).map((s) => ({
        id: s.id,
        localDate: s.localDate,
        minutes: s.minutes,
        source: s.source,
        note: s.note,
        estimated: s.estimated,
      })),
      lastSessionLocalDate,
      dormant,
    };
  });

  // Active first (by name), dormant last; id as the final tiebreaker for a stable order.
  tracks.sort((a, b) => {
    if (a.dormant !== b.dormant) return a.dormant ? 1 : -1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { skills: tracks };
}

/**
 * Mastery hours as `H:MM` from integer minutes — EXACT integer divmod (no float):
 * hours = (min − min%60) / 60 (always divisible), minutes = min%60, zero-padded. The
 * counter's list-card form.
 */
export function formatMasteryShort(minutes: number): string {
  const safe = Number.isFinite(minutes) && minutes > 0 ? Math.trunc(minutes) : 0;
  const mm = safe % 60;
  const hours = (safe - mm) / 60;
  return `${hours}:${String(mm).padStart(2, "0")}`;
}

/**
 * The drill hero's form — `H:MM:00`. Seconds are pinned to `:00`; they only move once the
 * Focus timer live-tick lands (deferred with F8), so the hero is static-derived here.
 */
export function formatMasteryLong(minutes: number): string {
  return `${formatMasteryShort(minutes)}:00`;
}
