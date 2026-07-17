/**
 * tests/game.test.ts — core/game (SAR-004, D-G). Pure functions: determinism,
 * integer-only, level thresholds, grace-aware streaks, reverse∘apply = identity.
 * No DB, no providers, no clock.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProgress,
  computeStreak,
  levelForXp,
  reverseProgress,
  xpForProposal,
  type ProgressState,
} from "../core/game";

test("xpForProposal: integer, deterministic, minutes-scaled only for time kinds", () => {
  assert.equal(xpForProposal("transaction"), 10);
  assert.equal(xpForProposal("water"), 5);
  assert.equal(xpForProposal("skillSession", 90), 19); // 10 + floor(90/10)*1
  assert.equal(xpForProposal("skillSession", 95), 19); // floors partial 10s
  assert.equal(xpForProposal("workout", 30), 18); // 15 + 3
  assert.equal(xpForProposal("meal", 999), 10); // minutes ignored for non-time kinds
  assert.equal(xpForProposal("skillSession", 90), xpForProposal("skillSession", 90));
  assert.ok(Number.isInteger(xpForProposal("skillSession", 90)));
});

test("levelForXp: fixed thresholds, integer, extends past the table", () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(249), 2);
  assert.equal(levelForXp(250), 3);
  assert.equal(levelForXp(2700), 10);
  assert.equal(levelForXp(2700 + 600), 11);
  assert.ok(Number.isInteger(levelForXp(12_345)));
});

test("computeStreak: grace-aware and deterministic", () => {
  assert.equal(computeStreak(["2026-07-15", "2026-07-16", "2026-07-17"], "2026-07-17", 0), 3);
  // a one-day gap breaks at grace 0…
  assert.equal(computeStreak(["2026-07-14", "2026-07-16", "2026-07-17"], "2026-07-17", 0), 2);
  // …but grace 1 tolerates it.
  assert.equal(computeStreak(["2026-07-14", "2026-07-16", "2026-07-17"], "2026-07-17", 1), 3);
  // stale beyond the grace window from today → 0
  assert.equal(computeStreak(["2026-07-10"], "2026-07-17", 1), 0);
  assert.equal(computeStreak([], "2026-07-17", 1), 0);
  // duplicate same-day activity counts once
  assert.equal(computeStreak(["2026-07-17", "2026-07-17"], "2026-07-17", 0), 1);
});

test("reverse∘apply = identity on xp/level/streak/minutes", () => {
  const before: ProgressState = {
    xp: 240,
    level: levelForXp(240),
    streak: 2,
    bestStreak: 5,
    cumulativeMinutes: 120,
    lastActiveDate: "2026-07-16",
  };
  const { after, effect } = applyProgress(before, {
    xpDelta: 19,
    minutesDelta: 90,
    streakAfter: 3,
    lastActiveDate: "2026-07-17",
  });

  assert.equal(after.xp, 259);
  assert.equal(after.level, levelForXp(259));
  assert.equal(after.streak, 3);
  assert.equal(after.cumulativeMinutes, 210);
  assert.equal(after.bestStreak, 5); // max(5, 3)

  const reversed = reverseProgress(after, effect);
  assert.equal(reversed.xp, before.xp);
  assert.equal(reversed.level, before.level);
  assert.equal(reversed.streak, before.streak);
  assert.equal(reversed.cumulativeMinutes, before.cumulativeMinutes);
});
