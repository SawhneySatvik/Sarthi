/**
 * tests/skills-view.test.ts — SAR-010 (D-F). The pure Skills lens read-model. Keyless.
 * Proves: per-skill mastery is the SUM of that skill's own `skill_sessions.minutes`
 * (two skills' sessions NEVER cross — the NOT-`domain_progress.cumulativeMinutes` proof),
 * integer-only hours formatting, the 10/100/500h display tiers at their minute
 * boundaries, milestone ✓/▸/○ mapping + ordering, the 14-day dormant boundary, null/zero
 * target handling, session-log recency + cap + passthrough, skill ordering, and the empty
 * view. No framework/DB import — the model is a pure function over three record arrays.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSkillsView,
  formatMasteryLong,
  formatMasteryShort,
  type SkillsInput,
} from "../core/domains/skills";
import type { SkillMilestoneRecord, SkillRecord, SkillSessionRecord } from "../data/schema/contract";

const TODAY = "2026-07-18";
const BASE = { userId: "local-dev", createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z", deletedAt: null };

function skill(over: Partial<SkillRecord> & { id: string }): SkillRecord {
  return { ...BASE, name: over.id, targetMinutes: null, isArchived: false, ...over } as SkillRecord;
}

function milestone(over: Partial<SkillMilestoneRecord> & { id: string; skillId: string; sortOrder: number }): SkillMilestoneRecord {
  return { ...BASE, label: over.id, completedAt: null, ...over } as SkillMilestoneRecord;
}

function session(
  over: Partial<SkillSessionRecord> & { id: string; skillId: string; localDate: string; minutes: number },
): SkillSessionRecord {
  return {
    ...BASE,
    occurredAt: `${over.localDate}T18:00:00.000Z`,
    timezone: "UTC",
    source: "capture",
    note: null,
    confidenceBps: 9000,
    estimated: false,
    ...over,
  } as SkillSessionRecord;
}

function build(over: Partial<SkillsInput>): ReturnType<typeof buildSkillsView> {
  return buildSkillsView({ localDate: TODAY, skills: [], milestones: [], sessions: [], ...over });
}

// ── per-skill sum isolation — the NOT-cumulativeMinutes proof ────────────────────────
test("mastery sums ONLY this skill's own sessions — two skills never cross", () => {
  const view = build({
    skills: [skill({ id: "sys" }), skill({ id: "guitar" })],
    sessions: [
      session({ id: "s1", skillId: "sys", localDate: TODAY, minutes: 90 }),
      session({ id: "s2", skillId: "sys", localDate: TODAY, minutes: 30 }),
      session({ id: "g1", skillId: "guitar", localDate: TODAY, minutes: 45 }),
    ],
  });
  const sys = view.skills.find((s) => s.id === "sys")!;
  const guitar = view.skills.find((s) => s.id === "guitar")!;
  assert.equal(sys.masteryMinutes, 120); // 90 + 30 — NOT 165 (would be a cross-skill/domain rollup)
  assert.equal(guitar.masteryMinutes, 45);
});

test("a skill with no sessions has zero mastery (never borrows another's minutes)", () => {
  const view = build({
    skills: [skill({ id: "a" }), skill({ id: "b" })],
    sessions: [session({ id: "s1", skillId: "a", localDate: TODAY, minutes: 200 })],
  });
  assert.equal(view.skills.find((s) => s.id === "b")!.masteryMinutes, 0);
});

// ── integer-only hours formatting ────────────────────────────────────────────────────
test("formatMasteryShort / Long are exact integer divmod (no float)", () => {
  assert.equal(formatMasteryShort(0), "0:00");
  assert.equal(formatMasteryShort(65), "1:05");
  assert.equal(formatMasteryShort(600), "10:00");
  assert.equal(formatMasteryShort(7710), "128:30");
  assert.equal(formatMasteryLong(7710), "128:30:00");
  assert.equal(formatMasteryLong(0), "0:00:00");
});

// ── 10/100/500h display tiers at minute boundaries ───────────────────────────────────
function tierOf(minutes: number) {
  const view = build({ skills: [skill({ id: "x" })], sessions: [session({ id: "s", skillId: "x", localDate: TODAY, minutes })] });
  const t = view.skills[0];
  return { thresholdHours: t.thresholdHours, nextThresholdHours: t.nextThresholdHours };
}

test("threshold tiers cross exactly at 600/6000/30000 minutes", () => {
  assert.deepEqual(tierOf(599), { thresholdHours: 0, nextThresholdHours: 10 });
  assert.deepEqual(tierOf(600), { thresholdHours: 10, nextThresholdHours: 100 });
  assert.deepEqual(tierOf(601), { thresholdHours: 10, nextThresholdHours: 100 });
  assert.deepEqual(tierOf(5999), { thresholdHours: 10, nextThresholdHours: 100 });
  assert.deepEqual(tierOf(6000), { thresholdHours: 100, nextThresholdHours: 500 });
  assert.deepEqual(tierOf(29999), { thresholdHours: 100, nextThresholdHours: 500 });
  assert.deepEqual(tierOf(30000), { thresholdHours: 500, nextThresholdHours: null });
  assert.deepEqual(tierOf(0), { thresholdHours: 0, nextThresholdHours: 10 });
});

// ── milestone ✓/▸/○ mapping + ordering ───────────────────────────────────────────────
test("milestones: done=completed, current=first incomplete, rest upcoming — by sortOrder", () => {
  const view = build({
    skills: [skill({ id: "x" })],
    milestones: [
      milestone({ id: "m3", skillId: "x", sortOrder: 3 }),
      milestone({ id: "m1", skillId: "x", sortOrder: 1, completedAt: "2026-06-10T00:00:00.000Z" }),
      milestone({ id: "m2", skillId: "x", sortOrder: 2 }),
      milestone({ id: "m4", skillId: "x", sortOrder: 4, completedAt: "2026-06-20T00:00:00.000Z" }),
    ],
  });
  const ms = view.skills[0].milestones;
  assert.deepEqual(ms.map((m) => m.sortOrder), [1, 2, 3, 4]); // ordered
  assert.deepEqual(ms.map((m) => m.state), ["done", "current", "upcoming", "done"]);
  // A later-completed milestone (m4) does NOT suppress the earlier incomplete m2 from being current.
});

test("milestones cross-skill isolation: a skill only sees its own curriculum", () => {
  const view = build({
    skills: [skill({ id: "a" }), skill({ id: "b" })],
    milestones: [
      milestone({ id: "am", skillId: "a", sortOrder: 1 }),
      milestone({ id: "bm", skillId: "b", sortOrder: 1 }),
    ],
  });
  assert.deepEqual(view.skills.find((s) => s.id === "a")!.milestones.map((m) => m.id), ["am"]);
  assert.deepEqual(view.skills.find((s) => s.id === "b")!.milestones.map((m) => m.id), ["bm"]);
});

// ── dormant boundary (14 days) ───────────────────────────────────────────────────────
test("dormant flips strictly past 14 days since the last session", () => {
  const at = (id: string, daysAgo: number) => {
    const d = new Date(Date.UTC(2026, 6, 18 - daysAgo)).toISOString().slice(0, 10);
    return { id, session: session({ id: `${id}-s`, skillId: id, localDate: d, minutes: 30 }) };
  };
  const active = at("active", 14); // exactly 14d → still active
  const stale = at("stale", 15); // 15d → dormant
  const view = build({
    skills: [skill({ id: "active" }), skill({ id: "stale" })],
    sessions: [active.session, stale.session],
  });
  assert.equal(view.skills.find((s) => s.id === "active")!.dormant, false);
  assert.equal(view.skills.find((s) => s.id === "stale")!.dormant, true);
});

test("a skill with no session at all is dormant", () => {
  const view = build({ skills: [skill({ id: "x" })] });
  assert.equal(view.skills[0].dormant, true);
  assert.equal(view.skills[0].lastSessionLocalDate, null);
});

// ── null / zero target handling ──────────────────────────────────────────────────────
test("fraction is null for a null OR zero target (no divide-by-zero)", () => {
  const view = build({
    skills: [skill({ id: "none" }), skill({ id: "zero", targetMinutes: 0 }), skill({ id: "real", targetMinutes: 6000 })],
    sessions: [
      session({ id: "s1", skillId: "none", localDate: TODAY, minutes: 100 }),
      session({ id: "s2", skillId: "zero", localDate: TODAY, minutes: 100 }),
      session({ id: "s3", skillId: "real", localDate: TODAY, minutes: 3000 }),
    ],
  });
  assert.equal(view.skills.find((s) => s.id === "none")!.fraction, null);
  assert.equal(view.skills.find((s) => s.id === "zero")!.fraction, null);
  assert.equal(view.skills.find((s) => s.id === "real")!.fraction, 0.5); // 3000/6000
});

test("fraction clamps to 1 when mastery exceeds the target", () => {
  const view = build({
    skills: [skill({ id: "x", targetMinutes: 600 })],
    sessions: [session({ id: "s", skillId: "x", localDate: TODAY, minutes: 900 })],
  });
  assert.equal(view.skills[0].fraction, 1);
});

// ── session log: recency, cap, passthrough ───────────────────────────────────────────
test("session log is most-recent-first, capped at 10, with source/estimated passthrough", () => {
  const sessions: SkillSessionRecord[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10);
    sessions.push(session({ id: `s${String(i).padStart(2, "0")}`, skillId: "x", localDate: d, minutes: 10 + i }));
  }
  sessions.push(session({ id: "est", skillId: "x", localDate: "2026-07-17", minutes: 45, source: "capture", estimated: true }));
  const view = build({ skills: [skill({ id: "x" })], sessions });
  const log = view.skills[0].sessions;
  assert.equal(log.length, 10); // capped
  // Most recent first: 2026-07-17 (est) then 2026-07-12 (s11) …
  assert.equal(log[0].id, "est");
  assert.equal(log[0].estimated, true);
  assert.equal(log[0].source, "capture");
  assert.equal(log[1].id, "s11");
  // The lifetime SUM still counts every session (13), even though only 10 render.
  assert.equal(view.skills[0].masteryMinutes, sessions.reduce((n, s) => n + s.minutes, 0));
});

// ── skill ordering + empty view ──────────────────────────────────────────────────────
test("skills order active-first (by name) then dormant last", () => {
  const view = build({
    skills: [
      skill({ id: "z-active" }),
      skill({ id: "a-active" }),
      skill({ id: "m-dormant" }),
    ],
    sessions: [
      session({ id: "za", skillId: "z-active", localDate: TODAY, minutes: 30 }),
      session({ id: "aa", skillId: "a-active", localDate: TODAY, minutes: 30 }),
      session({ id: "md", skillId: "m-dormant", localDate: "2026-06-01", minutes: 30 }),
    ],
  });
  assert.deepEqual(view.skills.map((s) => s.id), ["a-active", "z-active", "m-dormant"]);
});

test("empty input → empty view (the invite-card path)", () => {
  const view = buildSkillsView({ localDate: TODAY, skills: [], milestones: [], sessions: [] });
  assert.deepEqual(view.skills, []);
});
