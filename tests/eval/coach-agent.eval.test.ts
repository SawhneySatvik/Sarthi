/**
 * tests/eval/coach-agent.eval.test.ts — COACH-2 gate (keyless, deterministic). Drives the
 * grounded, persistent `converse` through six fixtures on the fake stack + the migrated
 * eval DB (no network, no keys) and hard-asserts the moat numbers:
 *   groundedAnswerRate = 1.0 · ungroundedNumericClaims = 0 · pinnedGoalRetention = 1.0 ·
 *   wrongSilentWrites === 0 (reusing `countEstimatedWrites`) · a Layer-1 memory-persistence
 *   assertion (turn 2 sees turn 1's transcript).
 *
 * Grounding + retention are measured on the CAPTURED step envelopes + the persisted coach
 * answer, so the metric truly reflects what `converse` assembled and returned (not a
 * re-implementation of the loop). The fake is input-aware, so the money/progress numbers are
 * real functions of the seeded rows.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createCoachEngine } from "../../core/coach";
import type { CoachAgentEnvelope } from "../../core/coach/agent";
import type { UserScopedRepositories } from "../../core/contracts";
import { EVAL_NOW, evalSetup } from "./harness";
import { countEstimatedWrites } from "./report";
import {
  COACH_EVAL_LOCAL_DATE,
  capturingGateway,
  envelopesFromPrompts,
  groundedIntUniverse,
  seedHealthPlanItem,
  seedMemories,
  seedMoneyPlanItem,
  seedMoneyWindow,
  seedProgress,
  ungroundedNumericClaims,
} from "./coach-fixtures";

const metrics = {
  totalTurns: 0,
  groundedTurns: 0,
  ungroundedNumericClaims: 0,
  goalSeededTurns: 0,
  goalRetainedTurns: 0,
  wrongSilentWrites: 0,
};

let savedFetch: typeof globalThis.fetch;
const savedKeys: Record<string, string | undefined> = {};
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("coach eval must not hit the network");
  }) as typeof globalThis.fetch;
  for (const key of ["GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) {
    savedKeys[key] = process.env[key];
    delete process.env[key];
  }
});
after(() => {
  globalThis.fetch = savedFetch;
  for (const [key, value] of Object.entries(savedKeys)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function buildEngine() {
  const { repos, llm, service } = await evalSetup();
  const prompts: string[] = [];
  const capturing = capturingGateway(llm, prompts);
  const engine = createCoachEngine({ repos, llm: capturing, commits: service, now: () => EVAL_NOW });
  return { repos, engine, prompts };
}

/** Run one turn, capture its envelopes, and fold its grounding/retention into `metrics`. */
async function converseTurn(
  engine: ReturnType<typeof createCoachEngine>,
  prompts: string[],
  text: string,
  goalText?: string,
) {
  prompts.length = 0;
  const { message, proposedAdaptation } = await engine.converse({ text, timezone: "Asia/Kolkata", localDate: COACH_EVAL_LOCAL_DATE });
  const envelopes: CoachAgentEnvelope[] = envelopesFromPrompts(prompts);
  const universe = groundedIntUniverse(envelopes);
  const ungrounded = ungroundedNumericClaims(message.text, universe);

  metrics.totalTurns += 1;
  metrics.ungroundedNumericClaims += ungrounded;
  if (ungrounded === 0) metrics.groundedTurns += 1;
  if (goalText) {
    metrics.goalSeededTurns += 1;
    // Retention is an ENVELOPE property (all pinned returned unconditionally), never an
    // answer-text property (the fake only echoes a goal when its domain is touched).
    const retained = envelopes.length > 0 && envelopes.every((env) => env.memories.pinned.some((memory) => memory.text === goalText));
    if (retained) metrics.goalRetainedTurns += 1;
  }
  return { message, proposedAdaptation, envelopes, ungrounded };
}

async function foldWrongSilentWrites(repos: UserScopedRepositories) {
  metrics.wrongSilentWrites += await countEstimatedWrites(repos);
}

test("coach eval · money question — grounded paise total, pinned goal retained", async () => {
  const { repos, engine, prompts } = await buildEngine();
  await seedMoneyWindow(repos, [34000, 20000, 30000]);
  const { goalText } = await seedMemories(repos);

  const { message, proposedAdaptation, ungrounded } = await converseTurn(engine, prompts, "How's my spending this week?", goalText);
  assert.match(message.text, /84000 paise/, "the answer cites the real seeded total");
  assert.equal(proposedAdaptation, null, "a plain money question proposes nothing");
  assert.equal(ungrounded, 0);

  // toolLogJson is the MAPPED bounded shape (degraded/stepsUsed lifted onto the log,
  // per-entry `{tool, ok, args, resultSummary, entryIds}`) — never the raw CoachAgentResult.
  const log = message.toolLogJson;
  assert.ok(log, "the coach turn persists its grounded tool log");
  assert.equal(typeof log?.degraded, "boolean");
  assert.equal(typeof log?.stepsUsed, "number");
  const moneyEntry = log?.entries.find((entry) => entry.tool === "read-domain-evidence");
  assert.ok(moneyEntry, "the money read is in the persisted log");
  assert.ok(Array.isArray(moneyEntry?.entryIds), "entries carry mapped entryIds, not raw evidence rows");
  const txnIds = (await repos.money.transactions.list({})).map((row) => row.id).sort();
  assert.deepEqual([...(moneyEntry?.entryIds ?? [])].sort(), txnIds, "the mapped entryIds resolve to the real rows");
  assert.equal(message.modelProvider, "fake", "the authoring provider is captured onto the row");
  assert.equal(message.proposedAdaptationId, null, "no adaptation row linked in C2");

  await foldWrongSilentWrites(repos);
});

test("coach eval · progress question — reads progress, no invented figures", async () => {
  const { repos, engine, prompts } = await buildEngine();
  await seedProgress(repos);
  const { goalText } = await seedMemories(repos);

  const { proposedAdaptation, envelopes, ungrounded } = await converseTurn(engine, prompts, "How's my progress and streak looking?", goalText);
  assert.ok(envelopes.some((env) => env.toolLog.some((entry) => entry.tool === "read-progress" && entry.ok)), "the loop reads progress");
  assert.equal(proposedAdaptation, null);
  assert.equal(ungrounded, 0);
  await foldWrongSilentWrites(repos);
});

test("coach eval · adjust intent — one adaptation intent surfaced, NO row created (C3 defers)", async () => {
  const { repos, engine, prompts } = await buildEngine();
  const itemId = await seedHealthPlanItem(repos, 25);
  await seedMemories(repos);

  const { message, proposedAdaptation } = await converseTurn(engine, prompts, "That feels heavy — make my plan lighter.");
  assert.ok(proposedAdaptation, "an adjustable health target yields one intent");
  assert.equal(proposedAdaptation?.planItemId, itemId);
  assert.equal(proposedAdaptation?.targetValue, 20, "25 − floor(25/5)");
  assert.equal((await repos.coach.adaptations.list({})).length, 0, "C2 creates no adaptation row");
  assert.equal(message.proposedAdaptationId, null, "the persisted coach turn links no row yet");
  assert.equal((await repos.plans.items.byId(itemId))?.targetValue, 25, "the plan item is byte-unchanged");
  await foldWrongSilentWrites(repos);
});

test("coach eval · money-adjust refusal — money plans cannot be coach-adjusted", async () => {
  const { repos, engine, prompts } = await buildEngine();
  await seedMoneyPlanItem(repos, 500000);
  await seedMemories(repos);

  // No "money" word → the loop reads the plan and finds only the money item, which excludes
  // propose-adaptation → the exclusion path (not a keyword reroute) is what refuses.
  const { proposedAdaptation, envelopes } = await converseTurn(engine, prompts, "Make my plan lighter, it feels too heavy.");
  assert.ok(envelopes.some((env) => env.toolLog.some((entry) => entry.tool === "read-plan" && entry.ok)), "the loop reads the plan");
  assert.equal(proposedAdaptation, null, "money excludes propose-adaptation");
  assert.equal((await repos.coach.adaptations.list({})).length, 0);
  await foldWrongSilentWrites(repos);
});

test("coach eval · no-data — honest answer, zero invented numbers", async () => {
  const { repos, engine, prompts } = await buildEngine();

  const { message, ungrounded } = await converseTurn(engine, prompts, "How's my spending this week?");
  assert.equal(ungrounded, 0, "no fabricated numbers with no data");
  assert.doesNotMatch(message.text, /\d{3,}/, "no invented multi-digit figure");
  await foldWrongSilentWrites(repos);
});

test("coach eval · memory across turns — turn 2 sees turn 1's transcript; goal retained both turns", async () => {
  const { repos, engine, prompts } = await buildEngine();
  await seedMoneyWindow(repos, [50000]);
  await seedProgress(repos);
  const { goalText } = await seedMemories(repos);

  const turn1Question = "How's my spending this week?";
  await converseTurn(engine, prompts, turn1Question, goalText);
  const turn2 = await converseTurn(engine, prompts, "And how is my overall progress?", goalText);

  // Layer 1: turn 2's envelope transcript carries turn 1's question (the raw buffer persists;
  // the substring survives the untrusted fence).
  assert.ok(
    turn2.envelopes.some((env) => env.transcript.some((entry) => entry.text.includes(turn1Question))),
    "turn 2 must see turn 1's transcript",
  );

  const persisted = await repos.coach.messages.list({});
  assert.equal(persisted.length, 4, "two user + two coach rows persist");
  assert.equal(persisted.filter((row) => row.role === "user").length, 2);
  assert.equal(persisted.filter((row) => row.role === "coach").length, 2);
  await foldWrongSilentWrites(repos);
});

test("COACH-2 GATE — groundedAnswerRate=1.0, ungrounded=0, pinnedGoalRetention=1.0, wrongSilentWrites=0", () => {
  assert.ok(metrics.totalTurns >= 6, `at least six coach turns ran: ${JSON.stringify(metrics)}`);
  assert.equal(metrics.ungroundedNumericClaims, 0, "no ungrounded numeric claims across every turn");
  assert.equal(metrics.groundedTurns / metrics.totalTurns, 1.0, "groundedAnswerRate === 1.0");
  assert.ok(metrics.goalSeededTurns > 0, "the pinned goal was exercised");
  assert.equal(metrics.goalRetainedTurns / metrics.goalSeededTurns, 1.0, "pinnedGoalRetention === 1.0");
  assert.equal(metrics.wrongSilentWrites, 0, "converse never writes an estimated typed row");
});
