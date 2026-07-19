/**
 * tests/eval/f3-gate.eval.test.ts — SAR-007 (D-E). THE F3 GATE. Keyless, deterministic.
 * Drives the four Architecture gate-3 fixtures through the landed F3 pipeline and
 * hard-asserts `wrongSilentWrites === 0` as an AGGREGATE over every scenario (closes
 * handsoff_04 N-6). Canonical goes through the real `parseDump` hop; the other three
 * are hand-built drafts (the content-blind fake gateway can only yield the canonical
 * draft). Nothing estimated/ambiguous/low-confidence writes without an explicit accept.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { parseDump, prepareDraft, resolveProposal } from "../../core/capture";
import {
  ambiguousSkillFixture,
  estimatedMealPhotoFixture,
  undoBatchFixture,
} from "../fixtures/capture";
import { EVAL_NOW, EVAL_WITHIN, evalSetup } from "./harness";
import { countEstimatedWrites, countTypedRows, type EvalReport } from "./report";

const report: EvalReport = { runId: "f3-gate", generatedAt: EVAL_NOW, fixtures: [], metrics: { wrongSilentWrites: 0 } };

function record(id: string, wrongSilentWrites: number, expectedRows: number, actualRows: number) {
  report.fixtures.push({ id, pass: wrongSilentWrites === 0, expectedRows, actualRows, wrongSilentWrites });
  report.metrics.wrongSilentWrites += wrongSilentWrites;
}

let savedFetch: typeof globalThis.fetch;
const savedKeys: Record<string, string | undefined> = {};
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("F3 eval must not hit the network");
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

test("gate · canonical-cross-domain: explicit rows auto-file, estimates stay pending", async () => {
  const { repos, service, llm } = await evalSetup();

  // F3 step 2 — the real deep-tier parse hop (fake gateway, keyless).
  const parsed = await parseDump(
    { rawText: "Spent 340 on lunch, 90 min of system design", timezone: "Asia/Kolkata", capturedAt: EVAL_NOW, source: "text" },
    llm,
  );
  assert.ok(parsed.ok && parsed.draft, "canonical parse must succeed keyless");

  // F3 step 3 — route + resolve (with the seeded category + skill).
  const { autoCommit, pending } = await prepareDraft(parsed.draft, repos);
  assert.equal(autoCommit.length, 2, "transaction + skillSession auto-file");
  assert.equal(pending.length, 3, "meal (est) + water (unknown) + habitLog (<9000) pending");

  // F3 step 4/5 — commit the auto batch; the three pending must write NOTHING.
  await service.commit({ idempotencyKey: "g-canonical", kind: "capture", proposals: autoCommit });
  assert.equal((await repos.health.meals.list({})).length, 0);
  assert.equal((await repos.health.waterLogs.list({})).length, 0);
  assert.equal((await repos.habits.logs.list({})).length, 0);
  assert.equal((await repos.money.transactions.list({})).length, 1);
  assert.equal((await repos.skills.sessions.list({})).length, 1);

  const wsw = await countEstimatedWrites(repos);
  record("canonical-cross-domain", wsw, 2, await countTypedRows(repos));
  assert.equal(wsw, 0);
});

test("gate · estimated-meal-photo: no meal row until the card is accepted", async () => {
  const { repos, service } = await evalSetup();
  const { autoCommit, pending } = await prepareDraft(estimatedMealPhotoFixture.draft!, repos);
  assert.equal(autoCommit.length, 0, "an estimated photo meal never auto-files");
  assert.equal(pending.length, 1);
  assert.equal((await repos.health.meals.list({})).length, 0, "nothing written pre-accept");

  const wsw = await countEstimatedWrites(repos); // measured BEFORE the explicit accept
  record("estimated-meal-photo", wsw, 0, await countTypedRows(repos));
  assert.equal(wsw, 0);

  // Explicit accept → the estimate is now confirmed and writes (estimated:true, not silent).
  const accepted = await resolveProposal(estimatedMealPhotoFixture.draft!.proposals[0], repos, "accepted");
  assert.ok(accepted.ok);
  await service.commit({ idempotencyKey: "g-meal", kind: "tap", proposals: [accepted.resolved] });
  assert.equal((await repos.health.meals.list({})).length, 1, "written only on explicit accept");
});

test("gate · ambiguous-skill: question card, no invented skill/session", async () => {
  const { repos } = await evalSetup();
  const { autoCommit, pending } = await prepareDraft(ambiguousSkillFixture.draft!, repos);
  assert.equal(autoCommit.length, 0, "an unresolved skill never auto-files");
  assert.ok(pending.length >= 1);
  assert.equal((await repos.skills.sessions.list({})).length, 0, "no invented session");

  const wsw = await countEstimatedWrites(repos);
  record("ambiguous-skill", wsw, 0, await countTypedRows(repos));
  assert.equal(wsw, 0);
});

test("gate · undo-batch: commit then undo reverses rows + XP atomically", async () => {
  const { repos, service } = await evalSetup();
  const { autoCommit } = await prepareDraft(undoBatchFixture.draft!, repos);
  const committed = await service.commit({ idempotencyKey: "g-undo", kind: "capture", proposals: autoCommit });
  assert.equal((await repos.skills.sessions.list({})).length, 1);
  const before = (await repos.plans.progress.list({})).find((p) => p.domain === "skills");
  assert.ok(before && before.xp > 0);

  const wsw = await countEstimatedWrites(repos);
  record("undo-batch", wsw, 1, await countTypedRows(repos));
  assert.equal(wsw, 0);

  await service.undoLatest({ commitId: committed.commitId, now: EVAL_WITHIN });
  assert.equal((await repos.skills.sessions.list({})).length, 0, "rows reversed");
  assert.equal((await repos.plans.progress.list({})).find((p) => p.domain === "skills")?.xp, 0, "XP reversed");
});

test("F3 GATE — wrongSilentWrites === 0 across all four gate-3 fixtures", () => {
  assert.equal(report.fixtures.length, 4, "all four gate-3 fixtures ran");
  assert.ok(report.fixtures.every((f) => f.pass), `every fixture passes: ${JSON.stringify(report.fixtures)}`);
  assert.equal(report.metrics.wrongSilentWrites, 0, "the hard aggregate release condition");
});
