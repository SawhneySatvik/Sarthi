/**
 * tests/capture-contract.test.ts — Architecture build-gate 9.2: the versioned
 * capture contract parses every SAR-004 fixture and rejects malformed drafts.
 * Pure schema — keyless, no DB, no providers.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { captureDraftSchema, proposalSchema, resolvedProposalSchema } from "../core/capture/contract";
import { allCaptureFixtures } from "./fixtures/capture";

test("gate 9.2: every fixture with a draft parses under captureDraftSchema", () => {
  for (const f of allCaptureFixtures) {
    if (f.draft === null) {
      assert.equal(f.expectParseError, true, `${f.id} has no draft, so must be marked expectParseError`);
      continue;
    }
    const r = captureDraftSchema.safeParse(f.draft);
    assert.ok(r.success, `${f.id} should parse: ${r.success ? "" : JSON.stringify(r.error.issues)}`);
  }
});

test("canonical fixture keeps its 5 proposals and its explicitly-null water volume", () => {
  const canonical = allCaptureFixtures.find((f) => f.id === "canonical-cross-domain");
  assert.ok(canonical?.draft);
  assert.equal(canonical.draft.proposals.length, 5);
  const water = canonical.draft.proposals.find((p) => p.kind === "water");
  assert.ok(water && water.kind === "water");
  assert.equal(water.payload.millilitres, null); // draft-permissive; must never auto-write
});

const draftBase = {
  proposalId: "x",
  domain: "health",
  intent: "create",
  occurredAt: "2026-07-17T05:15:00.000Z",
  localDate: "2026-07-17",
  timezone: "Asia/Kolkata",
  estimated: false,
  confidenceBps: 9500,
  why: { basis: "b", assumptions: [] as string[] },
  evidenceRefs: [] as unknown[],
};

test("proposalSchema rejects malformed drafts", () => {
  // float money
  assert.equal(
    proposalSchema.safeParse({
      ...draftBase,
      domain: "money",
      kind: "transaction",
      payload: { direction: "expense", amountPaise: 340.5, categoryName: "c", merchant: null, note: null },
    }).success,
    false,
  );
  // confidence out of range
  assert.equal(
    proposalSchema.safeParse({ ...draftBase, confidenceBps: 12000, kind: "water", payload: { millilitres: 500 } }).success,
    false,
  );
  // unknown kind
  assert.equal(proposalSchema.safeParse({ ...draftBase, kind: "sleep", payload: {} }).success, false);
  // missing `why`
  const noWhy: Record<string, unknown> = { ...draftBase };
  delete noWhy.why;
  assert.equal(proposalSchema.safeParse({ ...noWhy, kind: "water", payload: { millilitres: 500 } }).success, false);
});

test("draft-permissive vs resolved-strict: null water is a valid DRAFT but never a valid COMMIT input", () => {
  const waterDraft = { ...draftBase, kind: "water", payload: { millilitres: null } };
  // Draft layer accepts "mentioned but unknown".
  assert.equal(proposalSchema.safeParse(waterDraft).success, true);
  // Resolved (commit) layer rejects the null primary quantity outright.
  assert.equal(resolvedProposalSchema.safeParse({ ...waterDraft, status: "auto" }).success, false);
  // A resolved water with a real volume is accepted.
  assert.equal(
    resolvedProposalSchema.safeParse({ ...draftBase, kind: "water", status: "auto", payload: { millilitres: 500 } }).success,
    true,
  );
});
