/** SAR-014 — keyless coach, game derivation, and adaptation-safety coverage. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createCommitService } from "../core/capture";
import { createCoachEngine, DOMAIN_REGISTRY } from "../core/coach";
import { deriveGameSummary, deriveReentryCandidate } from "../core/game";
import { createRepositoryFactory } from "../data/repository";
import { createMemoryDb } from "./helpers/memory-db";
import { createLlmGateway } from "../providers";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const NOW = "2026-07-18T05:20:00.000Z";
const WITHIN = "2026-07-18T05:22:00.000Z";

let savedFetch: typeof globalThis.fetch;
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("coach tests must not hit network"); }) as typeof fetch;
});
after(() => { globalThis.fetch = savedFetch; });

async function setup() {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const llm = createLlmGateway("fake");
  const commits = createCommitService({ repos, llm, now: () => NOW });
  return { repos, commits, engine: createCoachEngine({ repos, llm, commits, now: () => NOW }) };
}

async function seedPlan(repos: Awaited<ReturnType<typeof setup>>["repos"], targetValue = 100) {
  const arc = await repos.plans.arcs.create({
    domain: "health", mode: "steady", title: "Health", startDate: "2026-07-01", endDate: null, dayNumber: 18, status: "active",
  });
  return repos.plans.items.create({
    arcId: arc.id, domain: "health", kind: "target", title: "Walk", dueAt: null, localDate: "2026-07-18",
    targetValue, targetUnit: "minutes", status: "pending", completionSource: null, ruleJson: null, linkedHabitId: null, linkedSkillId: null,
  });
}

test("coach registry has exactly the four locked DomainSpecs", () => {
  assert.deepEqual(DOMAIN_REGISTRY.map((spec) => spec.domain), ["health", "money", "habits", "skills"]);
  assert.equal(new Set(DOMAIN_REGISTRY.map((spec) => spec.domain)).size, 4);
});

test("daily brief is keyless, grounded, includes an open gap, and regenerates only on evidence change", async () => {
  const { repos, engine } = await setup();
  await repos.health.waterLogs.create({
    occurredAt: NOW, localDate: "2026-07-18", timezone: "Asia/Kolkata", millilitres: 750, source: "capture", confidenceBps: 10000, estimated: false,
  });
  await repos.profile.gaps.create({ gapKey: "food", prompt: "How do you usually eat?", optionsJson: ["Home", "Mixed"], status: "open", answeredAt: null });

  const first = await engine.dailyBrief({ localDate: "2026-07-18", timezone: "Asia/Kolkata" });
  const reused = await engine.dailyBrief({ localDate: "2026-07-18", timezone: "Asia/Kolkata" });
  assert.equal(first.id, reused.id, "same typed evidence must reuse one staleness-keyed note");
  assert.ok(first.evidenceJson.items.some((item) => item.entryKind === "water" && item.valueInt === 750));
  assert.ok(first.evidenceJson.items.some((item) => item.entryKind === "profileGap"), "open gap is context, not a write");

  await repos.health.waterLogs.create({
    occurredAt: NOW, localDate: "2026-07-18", timezone: "Asia/Kolkata", millilitres: 250, source: "capture", confidenceBps: 10000, estimated: false,
  });
  const regenerated = await engine.dailyBrief({ localDate: "2026-07-18", timezone: "Asia/Kolkata" });
  assert.notEqual(regenerated.id, first.id, "new typed evidence changes the staleness fingerprint");
  assert.equal((await repos.profile.gaps.list({}))[0].status, "open", "coach never answers or closes a gap");
});

test("game summary derives mastery, plan effects, evidence, and grace-aware re-entry without writes", async () => {
  const { repos, engine } = await setup();
  const item = await seedPlan(repos, 100);
  const skill = await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  await repos.skills.sessions.create({ occurredAt: NOW, localDate: "2026-07-10", timezone: "UTC", skillId: skill.id, minutes: 90, source: "capture", note: null, confidenceBps: 10000, estimated: false });
  await repos.evidence.create({ domain: "skills", entryKind: "skillSession", entryId: null, storageProvider: "fake", storagePath: "fixture", mimeType: "text/plain", sha256: "a".repeat(64), caption: null, occurredAt: NOW, localDate: "2026-07-10" });
  await repos.plans.progress.create({ domain: "skills", xp: 19, level: 1, streak: 1, bestStreak: 1, cumulativeMinutes: 90, lastActiveDate: "2026-07-10" });
  await repos.plans.items.update(item.id, { status: "done", completionSource: "capture" });

  const summary = await engine.gameSummary({ localDate: "2026-07-18" });
  assert.equal(summary.mastery[0].minutes, 90);
  assert.equal(summary.planEffects.capture, 1);
  assert.equal(summary.evidenceCounts.skills, 1);
  assert.equal(summary.reentryEligible, true);
  const candidate = deriveReentryCandidate({ localDate: "2026-07-18", progress: await repos.plans.progress.list({}), planItems: [await seedPlan(repos, 100)] });
  assert.ok(candidate);
  assert.equal(candidate.after.columns.targetValue, 80, "lightening uses integer arithmetic only");
});

test("F9 re-entry threshold is elapsed calendar days: two is ineligible, three is eligible", async () => {
  const { repos, engine } = await setup();
  await seedPlan(repos, 100);
  await repos.plans.progress.create({ domain: "health", xp: 0, level: 1, streak: 3, bestStreak: 3, cumulativeMinutes: 0, lastActiveDate: "2026-07-16" });
  const twoDays = await engine.gameSummary({ localDate: "2026-07-18" });
  assert.equal(twoDays.inactiveDays, 2);
  assert.equal(twoDays.reentryEligible, false);
  await repos.plans.progress.update((await repos.plans.progress.list({}))[0].id, { lastActiveDate: "2026-07-15" });
  const threeDays = await engine.gameSummary({ localDate: "2026-07-18" });
  assert.equal(threeDays.inactiveDays, 3);
  assert.equal(threeDays.reentryEligible, true);
});

test("Keep creates one typed undoable patch and undo coheres the adaptation", async () => {
  const { repos, commits, engine } = await setup();
  const item = await seedPlan(repos, 100);
  await repos.plans.progress.create({ domain: "health", xp: 0, level: 1, streak: 0, bestStreak: 0, cumulativeMinutes: 0, lastActiveDate: "2026-07-10" });

  const keptProposal = await engine.ensureReentryAdaptation({ localDate: "2026-07-18" });
  assert.ok(keptProposal);
  assert.equal(keptProposal.status, "proposed");
  assert.equal((await repos.plans.items.byId(item.id))?.targetValue, 100, "proposal never silently changes a plan");
  const [keepA, keepB] = await Promise.all([
    engine.resolveAdaptation({ adaptationId: keptProposal.id, action: "keep" }),
    engine.resolveAdaptation({ adaptationId: keptProposal.id, action: "keep" }),
  ]);
  assert.equal(keepA.id, keepB.id, "single-flight/replay keeps one adaptation lifecycle");
  assert.equal((await repos.plans.items.byId(item.id))?.targetValue, 80);
  assert.ok(keepA.appliedCommitId);
  const commitRows = (await repos.commits.rows.list({})).filter((row) => row.commitId === keepA.appliedCommitId);
  assert.equal(commitRows.length, 1);
  assert.equal(commitRows[0].entryKind, "planItem");
  const afterKeepOpen = await engine.ensureReentryAdaptation({ localDate: "2026-07-18" });
  assert.equal(afterKeepOpen?.id, keepA.id, "kept re-entry remains the absence episode; no stacked reduction");
  assert.equal((await repos.coach.adaptations.list({})).length, 1);
  const replayedKeep = await engine.resolveAdaptation({ adaptationId: keptProposal.id, action: "keep" });
  assert.equal(replayedKeep.appliedCommitId, keepA.appliedCommitId, "a repeat Keep replays the linked commit");
  assert.equal((await repos.commits.commits.list({})).length, 1, "repeat Keep creates no second plan-patch envelope");

  await commits.undoLatest({ commitId: keepA.appliedCommitId!, now: WITHIN });
  assert.equal((await repos.plans.items.byId(item.id))?.targetValue, 100);
  assert.equal((await repos.coach.adaptations.byId(keepA.id))?.status, "reverted");
  assert.equal((await repos.coach.adaptations.byId(keepA.id))?.appliedCommitId, null);
  const afterRevertOpen = await engine.ensureReentryAdaptation({ localDate: "2026-07-18" });
  assert.equal(afterRevertOpen?.id, keepA.id, "reverted re-entry remains visible without creating another proposal");
  assert.equal((await repos.coach.adaptations.list({})).length, 1);
});

test("proposed → revert preserves the plan and remains the re-entry episode", async () => {
  const { repos, engine } = await setup();
  const item = await seedPlan(repos, 100);
  await repos.plans.progress.create({ domain: "health", xp: 0, level: 1, streak: 0, bestStreak: 0, cumulativeMinutes: 0, lastActiveDate: "2026-07-10" });
  const proposed = await engine.ensureReentryAdaptation({ localDate: "2026-07-18" });
  assert.ok(proposed);
  const reverted = await engine.resolveAdaptation({ adaptationId: proposed.id, action: "revert" });
  assert.equal(reverted.status, "reverted");
  assert.equal((await repos.plans.items.byId(item.id))?.targetValue, 100);
  assert.equal((await engine.ensureReentryAdaptation({ localDate: "2026-07-18" }))?.id, proposed.id);
  assert.equal((await repos.coach.adaptations.list({})).length, 1);
});

test("pure re-entry lookup does not create a proposal; only the explicit ensure action does", async () => {
  const { repos, engine } = await setup();
  await seedPlan(repos, 100);
  await repos.plans.progress.create({ domain: "health", xp: 0, level: 1, streak: 0, bestStreak: 0, cumulativeMinutes: 0, lastActiveDate: "2026-07-10" });
  assert.equal(await engine.findReentryAdaptation({ localDate: "2026-07-18" }), null);
  assert.equal((await repos.coach.adaptations.list({})).length, 0);
  assert.ok(await engine.ensureReentryAdaptation({ localDate: "2026-07-18" }));
  assert.equal((await repos.coach.adaptations.list({})).length, 1);
  const repeatedProposed = await engine.ensureReentryAdaptation({ localDate: "2026-07-18" });
  assert.equal(repeatedProposed?.status, "proposed");
  assert.equal((await repos.coach.adaptations.list({})).length, 1);
});

test("adaptationSanityRate seam carries integer numerator and denominator", async () => {
  const { repos, engine } = await setup();
  await seedPlan(repos, 100);
  await repos.plans.progress.create({ domain: "health", xp: 0, level: 1, streak: 0, bestStreak: 0, cumulativeMinutes: 0, lastActiveDate: "2026-07-10" });
  await engine.ensureReentryAdaptation({ localDate: "2026-07-18" });
  const summary = await engine.gameSummary({ localDate: "2026-07-18" });
  assert.deepEqual(summary.adaptationSanity, { numerator: 1, denominator: 1, rateBps: 10_000 });
  assert.deepEqual(
    deriveGameSummary({ localDate: "2026-07-18", progress: [], skills: [], sessions: [], planItems: [], evidence: [] }).adaptationSanity,
    { numerator: 0, denominator: 0, rateBps: 10_000 },
  );
});
