/**
 * core/game/progress.ts — pure domain-progress transitions (SAR-004, D-G).
 *
 * `applyProgress` folds a commit's deltas into a `domain_progress` state and emits
 * the `commit_progress_effects` audit row. `reverseProgress` replays that recorded
 * effect exactly (never re-derives) for the fields the effect covers — xp, level,
 * streak, minutes. `bestStreak` and `lastActiveDate` are not derivable from the
 * delta alone, so the CommitService restores the `domain_progress` row from its
 * `commit_rows` snapshot on undo; this function is the pure kernel it composes.
 */
import { levelForXp } from "./xp";

/** The mutable per-domain progress state (mirrors the `domain_progress` scalar columns). */
export interface ProgressState {
  xp: number;
  level: number;
  streak: number;
  bestStreak: number;
  cumulativeMinutes: number;
  lastActiveDate: string | null;
}

/** The `commit_progress_effects` audit row for one domain touched by a commit. */
export interface ProgressEffect {
  xpDelta: number;
  levelBefore: number;
  levelAfter: number;
  streakBefore: number;
  streakAfter: number;
  minutesDelta: number;
}

export interface ProgressDeltas {
  xpDelta: number;
  minutesDelta: number;
  /** Recomputed by the caller via `computeStreak` over the domain's committed source rows. */
  streakAfter: number;
  lastActiveDate: string;
}

export function applyProgress(
  before: ProgressState,
  deltas: ProgressDeltas,
): { after: ProgressState; effect: ProgressEffect } {
  const xp = before.xp + deltas.xpDelta;
  const cumulativeMinutes = before.cumulativeMinutes + deltas.minutesDelta;
  const levelBefore = before.level;
  const levelAfter = levelForXp(xp);
  const streakBefore = before.streak;
  const streakAfter = deltas.streakAfter;

  const after: ProgressState = {
    xp,
    level: levelAfter,
    streak: streakAfter,
    bestStreak: Math.max(before.bestStreak, streakAfter),
    cumulativeMinutes,
    lastActiveDate: deltas.lastActiveDate,
  };
  const effect: ProgressEffect = {
    xpDelta: deltas.xpDelta,
    levelBefore,
    levelAfter,
    streakBefore,
    streakAfter,
    minutesDelta: deltas.minutesDelta,
  };
  return { after, effect };
}

/**
 * Reverse the effect-covered fields (xp / level / streak / minutes) exactly from
 * the recorded effect. `bestStreak`/`lastActiveDate` are carried through unchanged
 * here — the CommitService restores those from the row snapshot for an exact undo.
 */
export function reverseProgress(current: ProgressState, effect: ProgressEffect): ProgressState {
  return {
    xp: current.xp - effect.xpDelta,
    level: effect.levelBefore,
    streak: effect.streakBefore,
    bestStreak: current.bestStreak,
    cumulativeMinutes: current.cumulativeMinutes - effect.minutesDelta,
    lastActiveDate: current.lastActiveDate,
  };
}
