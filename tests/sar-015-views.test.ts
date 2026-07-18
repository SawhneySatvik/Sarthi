import assert from "node:assert/strict";
import test from "node:test";

import { buildCoachReadingView } from "@/core/coach";
import type { CoachEvidence, CoachNoteRecord, EvidenceRecord } from "@/data/schema/contract";
import { buildJourneyView, buildStatsView } from "@/core/game";
import { createRepositoryFactory } from "@/data/repository";
import { seedDemo } from "@/data/seed/demo";

import { createMemoryDb } from "./helpers/memory-db";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };

function coachNote(id: string, localDate: string, text: string): CoachNoteRecord {
  return { id, userId: "u", scope: "daily" as const, localDate, text, modelProvider: "fake", modelId: "seed", evidenceJson: { generatedForLocalDate: localDate, items: [] }, stalenessKey: id, createdAt: `${localDate}T00:00:00.000Z` };
}

function weeklyCoachNote(id: string, localDate: string, items: CoachEvidence["items"]): CoachNoteRecord {
  return { id, userId: "u", scope: "weekly", localDate, text: `Weekly ${id}`, modelProvider: "fake", modelId: "seed", evidenceJson: { generatedForLocalDate: localDate, items }, stalenessKey: id, createdAt: `${localDate}T00:00:00.000Z` };
}

function lifetimeEvidence(id: string, domain: EvidenceRecord["domain"]): EvidenceRecord {
  return { id, userId: "u", domain, entryKind: "capture", entryId: id, storageProvider: "fake", storagePath: id, mimeType: "text/plain", sha256: id, caption: id, occurredAt: "2026-07-19T12:00:00.000Z", localDate: "2026-07-19", createdAt: "2026-07-19T12:00:00.000Z", updatedAt: "2026-07-19T12:00:00.000Z", deletedAt: null };
}

test("keeps a proposed adaptation pending, never as an applied plan change", () => {
  const view = buildCoachReadingView({ localDate: "2026-07-18", notes: [], gaps: [], evidence: [], adaptations: [{ id: "a", userId: "u", planItemId: "p", beforeJson: { entryKind: "planItem", entryId: "p", columns: { title: "Gym", targetValue: 60, targetUnit: "minutes" } }, afterJson: { entryKind: "planItem", entryId: "p", columns: { title: "Gym", targetValue: 40, targetUnit: "minutes" } }, reason: "Travel", status: "proposed", keptAt: null, revertedAt: null, appliedCommitId: null, createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:00.000Z", deletedAt: null }] });
  assert.deepEqual(view.adaptations[0] && { status: view.adaptations[0].status, before: view.adaptations[0].before, after: view.adaptations[0].after }, { status: "proposed", before: "Gym · 60 minutes", after: "Gym · 40 minutes" });
});

test("keeps a stored weekly note in history until Sunday evening", () => {
  const storedWeekly = weeklyCoachNote("weekly-12", "2026-07-12", [{ domain: "money", entryKind: "transaction", entryId: "txn-1", label: "Lunch", valueInt: 34000, unit: "paise" }]);
  const view = buildCoachReadingView({ localDate: "2026-07-19", localTime: { weekday: 0, hour: 18 }, notes: [storedWeekly], gaps: [], adaptations: [], evidence: [] });

  assert.equal(view.weekly, null);
  assert.deepEqual(view.history, [storedWeekly]);
  assert.deepEqual({ evidenceCount: view.evidenceCount, weeklyDomainLines: view.weeklyDomainLines }, {
    evidenceCount: 0,
    weeklyDomainLines: [
      { domain: "health", count: 0, text: "Health: 0 typed entries" },
      { domain: "money", count: 0, text: "Money: 0 typed entries" },
      { domain: "habits", count: 0, text: "Habits: 0 typed entries" },
      { domain: "skills", count: 0, text: "Skills: 0 typed entries" },
    ],
  });
});

test("uses only the current Sunday weekly note and its grounded evidence", () => {
  const priorWeekly = weeklyCoachNote("weekly-12", "2026-07-12", [{ domain: "money", entryKind: "transaction", entryId: "txn-old", label: "Old spend", valueInt: 9900, unit: "paise" }]);
  const currentWeekly = weeklyCoachNote("weekly-19", "2026-07-19", [
    { domain: "health", entryKind: "meal", entryId: "meal-1", label: "Lunch", valueInt: 620, unit: "kcal" },
    { domain: "skills", entryKind: "session", entryId: "session-1", label: "System design", valueInt: 90, unit: "minutes" },
    { domain: "overall", entryKind: "summary", entryId: null, label: "Weekly summary", valueInt: null, unit: null },
  ]);
  const view = buildCoachReadingView({
    localDate: "2026-07-19", localTime: { weekday: 0, hour: 19 }, notes: [priorWeekly, currentWeekly], gaps: [], adaptations: [],
    evidence: [lifetimeEvidence("lifetime-money", "money"), lifetimeEvidence("lifetime-habit", "habits"), lifetimeEvidence("lifetime-health", "health")],
  });

  assert.deepEqual(view.weekly, currentWeekly);
  assert.deepEqual(view.history, [priorWeekly]);
  assert.deepEqual({ evidenceCount: view.evidenceCount, weeklyDomainLines: view.weeklyDomainLines }, {
    evidenceCount: 2,
    weeklyDomainLines: [
      { domain: "health", count: 1, text: "Health: 1 typed entry" },
      { domain: "money", count: 0, text: "Money: 0 typed entries" },
      { domain: "habits", count: 0, text: "Habits: 0 typed entries" },
      { domain: "skills", count: 1, text: "Skills: 1 typed entry" },
    ],
  });
});

test("groups real evidence by domain-local date deterministically and without duplicate cards", () => {
  const evidence = { id: "e", userId: "u", domain: "health" as const, entryKind: "meal", entryId: "meal-1", storageProvider: "placeholder", storagePath: "", mimeType: "image/jpeg", sha256: "x", caption: "Lunch", occurredAt: "2026-07-18T12:00:00.000Z", localDate: "2026-07-18", createdAt: "2026-07-18T12:00:00.000Z", updatedAt: "2026-07-18T12:00:00.000Z", deletedAt: null };
  const dinner = { ...evidence, id: "d", entryId: "meal-2", caption: "Dinner", occurredAt: "2026-07-18T20:00:00.000Z" };
  const view = buildJourneyView({ notes: [], evidence: [dinner, evidence, evidence] });
  const reordered = buildJourneyView({ notes: [], evidence: [evidence, dinner, evidence] });
  assert.deepEqual(view, reordered, "row order must not change the typed Journey projection");
  assert.equal(view.days.length, 1); assert.deepEqual(view.days[0]?.evidence[0] && { caption: view.days[0].evidence[0].caption, domain: view.days[0].evidence[0].domain }, { caption: "Dinner", domain: "health" });
  assert.equal(view.days[0]?.evidence.length, 2);
});

test("keeps a CoachNote-only date as a text-only Journey node", () => {
  const view = buildJourneyView({ evidence: [], notes: [coachNote("daily", "2026-07-18", "Keep the restart light.")] });
  assert.deepEqual(view.days, [{ localDate: "2026-07-18", month: "2026-07", evidence: [], note: "Keep the restart light.", milestones: [] }]);
});

test("derives stable milestone rows without duplicate threshold events", () => {
  const progress = { id: "p", userId: "u", domain: "skills" as const, xp: 300, level: 3, streak: 8, bestStreak: 8, cumulativeMinutes: 0, lastActiveDate: "2026-07-18", createdAt: "2026-07-01", updatedAt: "2026-07-18", deletedAt: null };
  const view = buildJourneyView({ evidence: [], notes: [], progress: [progress, progress], skills: [], sessions: [] });
  const reordered = buildJourneyView({ evidence: [], notes: [], progress: [progress, progress].reverse(), skills: [], sessions: [] });
  assert.deepEqual(view, reordered, "duplicate typed progress rows must project deterministically");
  assert.deepEqual(view.milestones.map((row) => row.id), ["level:skills:3", "streak:skills:7"]);
  assert.deepEqual(view.days[0]?.milestones.map((row) => row.id), ["level:skills:3", "streak:skills:7"]);
});

test("uses level one and an unavailable Day-1 face when rows are absent", () => {
  const view = buildStatsView({ progress: [], snapshots: [], arc: null, money: { safeToSpend: { valuePaise: 0, balancePaise: 0, remainingBudgetedPaise: 0, upcomingRecurringPaise: 0 } } as never, skills: { skills: [] }, healthAdherenceBps: 0, habitsBestStreak: 0 });
  assert.equal(view.overall.level, 1); assert.equal(view.cards.every((card) => card.level === 1 && card.dayOne === null), true);
});

test("seeds a 12-day typed Journey fixture without an overall Day-1 snapshot", async () => {
  const { db } = await createMemoryDb(); const repos = createRepositoryFactory(db).forUser(LOCAL);
  await seedDemo(repos);

  const snapshots = await repos.plans.dayOneSnapshots.list({});
  assert.deepEqual(new Set(snapshots.map((row) => row.domain)), new Set(["health", "money", "habits", "skills"]));
  assert.ok(!snapshots.some((row) => row.domain === "overall"));
  assert.equal((await repos.plans.arcs.list({}))[0]?.dayNumber, 12);
  const evidence = await repos.evidence.list({});
  assert.equal(evidence.length, 8);
  assert.deepEqual(new Set(evidence.map((row) => row.domain)), new Set(["health", "money", "habits", "skills"]));
  assert.ok(evidence.every((row) => row.entryId !== null && row.entryKind !== "seed"));
  const evidenceCountByLocalDate = new Map<string, number>();
  for (const row of evidence) {
    evidenceCountByLocalDate.set(row.localDate, (evidenceCountByLocalDate.get(row.localDate) ?? 0) + 1);
  }
  assert.ok([...evidenceCountByLocalDate.values()].some((count) => count === 2), "the populated Journey fixture retains a same-date two-photo expansion state");
  const notes = await repos.coach.notes.list({});
  assert.deepEqual(new Set(notes.map((row) => row.scope)), new Set(["daily", "weekly"]));
  assert.equal((await repos.coach.adaptations.list({}))[0]?.status, "proposed");

  const view = buildJourneyView({ evidence, notes, progress: await repos.plans.progress.list({}), arcs: await repos.plans.arcs.list({}), skills: await repos.skills.skills.list({}), sessions: await repos.skills.sessions.list({}) });
  assert.ok(view.milestones.length >= 2, "typed progress and skill sessions derive Journey milestones");
});
