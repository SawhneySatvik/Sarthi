/**
 * core/game/xp.ts — pure, deterministic XP + level functions (SAR-004, D-G).
 *
 * Integers only. No floats, no randomness, no clock reads. The award magnitudes
 * are a single reviewable table (OQ-2 (a)); Satvik tunes them anytime. The
 * coach/adaptation/mastery mechanics are SAR-014 — this file ships only
 * award-on-commit + level-from-xp.
 */
import type { ProposalKind } from "@/core/capture/contract";

/** Per-kind XP: a flat award plus, for time-based kinds, +`perTenMinutes` per full 10 minutes. */
export const XP_AWARDS: Record<ProposalKind, { base: number; perTenMinutes: number }> = {
  transaction: { base: 10, perTenMinutes: 0 },
  meal: { base: 10, perTenMinutes: 0 },
  water: { base: 5, perTenMinutes: 0 },
  workout: { base: 15, perTenMinutes: 1 },
  weighIn: { base: 5, perTenMinutes: 0 },
  habitLog: { base: 10, perTenMinutes: 0 },
  skillSession: { base: 10, perTenMinutes: 1 },
};

/** XP awarded for committing one proposal. `minutes` applies only to time-based kinds. */
export function xpForProposal(kind: ProposalKind, minutes = 0): number {
  const award = XP_AWARDS[kind];
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 0;
  return award.base + award.perTenMinutes * Math.floor(safeMinutes / 10);
}

/**
 * Cumulative XP required to first reach each level (index = level − 1). Beyond the
 * table every further level costs a flat `LEVEL_STEP`.
 */
export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700] as const;
const LEVEL_STEP = 600;

export function levelForXp(xp: number): number {
  const safeXp = xp > 0 ? Math.floor(xp) : 0;
  const top = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  if (safeXp >= top) {
    return LEVEL_THRESHOLDS.length + Math.floor((safeXp - top) / LEVEL_STEP);
  }
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (safeXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    }
  }
  return level;
}
