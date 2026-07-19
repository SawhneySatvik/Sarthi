/**
 * tests/capture-vision.test.ts — SAR-011. Unit-covers the photo entry ramp:
 *   1. `draftFromVisionResult` — integer passthrough, forced-estimated meal, photo
 *      evidence on the draft AND every proposal, timezone-correct localDate.
 *   2. the ONE routing edit — a photo-evidence proposal routes PENDING even when it is
 *      explicit and above the auto threshold; an empty-evidence proposal is unaffected.
 *   3. `parsePhoto` — a throwing or invalid vision result degrades to a retryable draft
 *      with zero side effects (mirrors parseDump's provider-failure posture).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  captureDraftSchema,
  draftFromVisionResult,
  parsePhoto,
  routeProposal,
  visionResultSchema,
  type Proposal,
} from "../core/capture";
import type { VisionProvider } from "../core/contracts";
import { createVisionProvider } from "../providers";
import { ESTIMATED_MEAL_PHOTO_FIXTURE, RECEIPT_BATCH_FIXTURE } from "../providers/fake/fixtures";

type TransactionProposal = Extract<Proposal, { kind: "transaction" }>;

const EMPTY_BLOCKED = new Set<string>();
// 20:00 UTC on the 17th is 01:30 IST on the 18th — proves localDate is zone-correct.
const CAPTURED_AT = "2026-07-17T20:00:00.000Z";
const TZ = "Asia/Kolkata";

test("mapper · meal photo → one forced-estimated proposal with integer macros + evidence", () => {
  const result = visionResultSchema.parse(ESTIMATED_MEAL_PHOTO_FIXTURE);
  const draft = draftFromVisionResult(result, {
    draftId: "photo-unit-meal",
    capturedAt: CAPTURED_AT,
    timezone: TZ,
    caption: null,
    mimeType: "image/jpeg",
  });

  assert.equal(captureDraftSchema.safeParse(draft).success, true, "mapper output is a valid CaptureDraft");
  assert.equal(draft.source, "photo");
  assert.equal(draft.evidenceRefs.length, 1);
  assert.deepEqual(draft.evidenceRefs[0], {
    ref: "photo:photo-unit-meal",
    mimeType: "image/jpeg",
    sha256: null,
    caption: null,
  });

  assert.equal(draft.proposals.length, 1);
  const meal = draft.proposals[0];
  assert.equal(meal.kind, "meal");
  assert.equal(meal.proposalId, "photo-unit-meal-meal");
  assert.equal(meal.estimated, true, "a photo meal is ALWAYS estimated, whatever the model claimed");
  assert.equal(meal.intent, "create");
  assert.equal(meal.localDate, "2026-07-18", "localDate is computed in the capture timezone");
  assert.equal(meal.evidenceRefs.length, 1, "the proposal carries the same photo evidence");
  if (meal.kind === "meal") {
    assert.equal(meal.payload.kcal, 520);
    assert.ok(Number.isInteger(meal.payload.kcal));
    assert.equal(meal.payload.proteinGrams, 18);
    assert.equal(meal.payload.items.length, 2);
    assert.deepEqual(meal.payload.items[0], { name: "roti", quantity: 2, unit: "piece" });
  }
});

test("mapper · receipt photo → N explicit integer-paise transactions with evidence", () => {
  const result = visionResultSchema.parse(RECEIPT_BATCH_FIXTURE);
  const draft = draftFromVisionResult(result, {
    draftId: "photo-unit-receipt",
    capturedAt: CAPTURED_AT,
    timezone: TZ,
    caption: null,
    mimeType: "image/jpeg",
  });

  assert.equal(draft.proposals.length, 2);
  assert.deepEqual(
    draft.proposals.map((p) => p.proposalId),
    ["photo-unit-receipt-txn-0", "photo-unit-receipt-txn-1"],
  );
  for (const p of draft.proposals) {
    assert.equal(p.kind, "transaction");
    assert.equal(p.estimated, false, "printed values are explicit, not estimated");
    assert.equal(p.domain, "money");
    assert.ok(p.evidenceRefs.length > 0, "every derived proposal carries photo evidence");
    if (p.kind === "transaction") {
      assert.ok(Number.isInteger(p.payload.amountPaise), "integer paise only — no float");
    }
  }
  const first = draft.proposals[0];
  if (first.kind === "transaction") {
    assert.equal(first.payload.amountPaise, 34000);
    assert.equal(first.payload.direction, "expense");
    assert.equal(first.payload.categoryName, "Food & dining");
    assert.equal(first.payload.merchant, "Lunch counter");
  }
});

test("routing · a photo-evidence proposal is PENDING even when explicit and ≥9000 bps", () => {
  const base = {
    proposalId: "vision-txn",
    domain: "money" as const,
    kind: "transaction" as const,
    intent: "create" as const,
    occurredAt: CAPTURED_AT,
    localDate: "2026-07-18",
    timezone: TZ,
    estimated: false,
    confidenceBps: 9800, // above the 9000 auto threshold
    why: { basis: "read from a receipt photo", assumptions: [] },
    payload: { direction: "expense" as const, amountPaise: 50000, categoryName: "Food & dining", merchant: null, note: null },
  };

  const withPhoto: TransactionProposal = {
    ...base,
    evidenceRefs: [{ ref: "photo:x", mimeType: "image/jpeg", sha256: null, caption: null }],
  };
  const routedPhoto = routeProposal(withPhoto, EMPTY_BLOCKED);
  assert.equal(routedPhoto.route, "pending", "photo evidence dominates the auto threshold");
  assert.ok(
    routedPhoto.reasons.includes("photo-derived value requires confirmation"),
    "the §5.1 rule-4 reason fires",
  );

  const withoutPhoto: Proposal = { ...base, evidenceRefs: [] };
  const routedPlain = routeProposal(withoutPhoto, EMPTY_BLOCKED);
  assert.equal(routedPlain.route, "auto", "an identical text proposal (empty evidence) is unaffected");
});

const throwingVision: VisionProvider = {
  async analyze() {
    throw new Error("vision provider exploded");
  },
};

const invalidVision: VisionProvider = {
  // Returns a well-formed ObjectResult whose object fails the vision result schema.
  async analyze() {
    return {
      object: { kind: "meal" } as never,
      modelId: "stub",
      provider: "fake" as const,
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: 0,
    };
  },
};

test("parsePhoto · a throwing vision provider degrades to a retryable draft (zero rows)", async () => {
  const res = await parsePhoto(
    { images: [{ bytes: new Uint8Array([1]), mimeType: "image/jpeg" }], timezone: TZ, capturedAt: CAPTURED_AT, photoType: "meal" },
    throwingVision,
  );
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.retryable, true);
});

test("parsePhoto · an invalid vision object never becomes a draft", async () => {
  const res = await parsePhoto(
    { images: [{ bytes: new Uint8Array([1]), mimeType: "image/jpeg" }], timezone: TZ, capturedAt: CAPTURED_AT, photoType: "meal" },
    invalidVision,
  );
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.retryable, true);
});

test("override #1 · the meal/receipt TOGGLE (not the filename) selects the fixture", async () => {
  const vision = createVisionProvider("fake");

  // A misleadingly-named file must NOT override the toggle: meal toggle → meal draft,
  // even though the filename contains "receipt".
  const meal = await parsePhoto(
    { images: [{ bytes: new Uint8Array([1]), mimeType: "image/jpeg", filename: "receipt.jpg" }], timezone: TZ, capturedAt: CAPTURED_AT, photoType: "meal" },
    vision,
  );
  assert.ok(meal.ok && meal.draft);
  assert.equal(meal.draft.proposals[0].kind, "meal", "the meal toggle wins over a 'receipt' filename");

  // The receipt toggle drives via the prompt with a NEUTRAL filename — no filename cue.
  const receipt = await parsePhoto(
    { images: [{ bytes: new Uint8Array([2]), mimeType: "image/jpeg", filename: "capture.jpg" }], timezone: TZ, capturedAt: CAPTURED_AT, photoType: "receipt" },
    vision,
  );
  assert.ok(receipt.ok && receipt.draft);
  assert.equal(receipt.draft.proposals[0].kind, "transaction", "the receipt toggle drives selection with no 'receipt' filename");
});
