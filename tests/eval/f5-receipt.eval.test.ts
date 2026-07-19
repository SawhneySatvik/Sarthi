/**
 * tests/eval/f5-receipt.eval.test.ts — SAR-011 (D-F). The F5 receipt gate, keyless.
 * Drives the PHOTO entry ramp through the landed pipeline on the fake vision stack:
 * FakeVisionProvider → parsePhoto → mapper → prepareDraft. Proves the SAR-011 slice of
 * the hard-zero release condition — `wrongSilentWrites === 0` now covers the photo
 * ramp — and F5's "typed Money rows once, never duplicated on retry, only on explicit
 * accept". A sibling of f3-gate so that file's four-fixture aggregate stays intact.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { parsePhoto, prepareDraft, resolveProposal } from "../../core/capture";
import type { ResolvedProposal } from "../../core/capture";
import { EVAL_NOW, EVAL_WITHIN, evalSetup } from "./harness";
import { countEstimatedWrites, countTypedRows, type EvalReport } from "./report";

// Neutral filenames on purpose (override #1): fixture selection must come from the
// toggle-derived prompt inside parsePhoto, never the filename.
const MEAL_IMAGE = [{ bytes: new Uint8Array([1]), mimeType: "image/jpeg" as const, filename: "capture.jpg" }];
const RECEIPT_IMAGE = [{ bytes: new Uint8Array([2]), mimeType: "image/jpeg" as const, filename: "capture.jpg" }];

const report: EvalReport = { runId: "f5-receipt", generatedAt: EVAL_NOW, fixtures: [], metrics: { wrongSilentWrites: 0 } };

function record(id: string, wrongSilentWrites: number, expectedRows: number, actualRows: number) {
  report.fixtures.push({ id, pass: wrongSilentWrites === 0, expectedRows, actualRows, wrongSilentWrites });
  report.metrics.wrongSilentWrites += wrongSilentWrites;
}

let savedFetch: typeof globalThis.fetch;
const savedKeys: Record<string, string | undefined> = {};
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("F5 eval must not hit the network");
  }) as typeof globalThis.fetch;
  for (const key of ["GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "VISION_API_KEY"]) {
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

test("gate · meal-photo: the real vision ramp never auto-files a meal row", async () => {
  const { repos, vision } = await evalSetup();

  const parsed = await parsePhoto(
    { images: MEAL_IMAGE, timezone: "Asia/Kolkata", capturedAt: EVAL_NOW, photoType: "meal" },
    vision,
  );
  assert.ok(parsed.ok && parsed.draft, "meal photo parses keyless");
  assert.equal(parsed.draft.source, "photo");
  const meal = parsed.draft.proposals[0];
  assert.equal(meal.kind, "meal");
  assert.equal(meal.estimated, true, "a photo meal is forced estimated");
  assert.ok(meal.evidenceRefs.length > 0, "photo evidence is attached");

  const { autoCommit, pending } = await prepareDraft(parsed.draft, repos);
  assert.equal(autoCommit.length, 0, "an estimated photo meal never auto-files");
  assert.equal(pending.length, 1);
  assert.equal((await repos.health.meals.list({})).length, 0, "nothing written pre-accept");

  const wsw = await countEstimatedWrites(repos);
  record("estimated-meal-photo", wsw, 0, await countTypedRows(repos));
  assert.equal(wsw, 0);
});

test("gate · receipt-batch: explicit paise write ONCE on accept, never on retry, none silently", async () => {
  const { repos, vision, service } = await evalSetup();
  // The receipt batch resolves against a seeded "Transport" category (Food & dining is
  // already seeded by evalSetup) — capture never invents a category (D-C).
  await repos.money.categories.create({ name: "Transport", kind: "expense", colorKey: null, isSystem: false });

  const parsed = await parsePhoto(
    { images: RECEIPT_IMAGE, timezone: "Asia/Kolkata", capturedAt: EVAL_NOW, photoType: "receipt" },
    vision,
  );
  assert.ok(parsed.ok && parsed.draft, "receipt photo parses keyless");
  assert.equal(parsed.draft.proposals.length, 2, "two printed transactions");
  for (const p of parsed.draft.proposals) {
    assert.equal(p.kind, "transaction");
    assert.equal(p.estimated, false, "printed values are explicit");
    assert.ok(Number.isInteger((p.payload as { amountPaise: number }).amountPaise), "integer paise only");
    assert.ok(p.evidenceRefs.length > 0, "photo evidence forces pending");
  }

  // Photo evidence pends BOTH explicit transactions — nothing auto-files, even ≥9000.
  const { autoCommit, pending } = await prepareDraft(parsed.draft, repos);
  assert.equal(autoCommit.length, 0, "photo-derived explicit values never auto-write");
  assert.equal(pending.length, 2);
  assert.equal((await repos.money.transactions.list({})).length, 0, "no silent write pre-accept");

  let wsw = await countEstimatedWrites(repos);
  record("receipt-batch", wsw, 2, await countTypedRows(repos));
  assert.equal(wsw, 0);

  // F5 — explicit Accept-all: resolve every pending card, commit ONE batch.
  const resolved: ResolvedProposal[] = [];
  for (const card of pending) {
    const outcome = await resolveProposal(card.proposal, repos, "accepted");
    assert.ok(outcome.ok, "seeded categories resolve");
    resolved.push(outcome.resolved);
  }
  const committed = await service.commit({ idempotencyKey: "f5-receipt", kind: "capture", proposals: resolved });
  const rows = await repos.money.transactions.list({});
  assert.equal(rows.length, 2, "exactly two typed transaction rows on accept");
  assert.deepEqual(
    rows.map((r) => r.amountPaise).sort((a, b) => a - b),
    [12000, 34000],
    "integer paise persisted verbatim",
  );

  // Idempotent replay — same key returns the original result, never a duplicate row.
  const replay = await service.commit({ idempotencyKey: "f5-receipt", kind: "capture", proposals: resolved });
  assert.equal(replay.commitId, committed.commitId, "replay returns the original commit");
  assert.equal((await repos.money.transactions.list({})).length, 2, "no duplicate rows on retry");

  // No estimated row anywhere; the accepted rows are explicit (estimated:false).
  wsw = await countEstimatedWrites(repos);
  assert.equal(wsw, 0, "receipt writes are explicit, never silent estimates");

  // Undo restores atomically.
  await service.undoLatest({ commitId: committed.commitId, now: EVAL_WITHIN });
  assert.equal((await repos.money.transactions.list({})).length, 0, "undo reverses the batch");
});

test("F5 GATE — wrongSilentWrites === 0 across the photo ramp", () => {
  assert.equal(report.fixtures.length, 2, "meal + receipt photo scenarios ran");
  assert.ok(report.fixtures.every((f) => f.pass), `every fixture passes: ${JSON.stringify(report.fixtures)}`);
  assert.equal(report.metrics.wrongSilentWrites, 0, "the hard aggregate release condition, extended to photos");
});
