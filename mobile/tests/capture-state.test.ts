import assert from "node:assert/strict";
import test from "node:test";

import { parseDump } from "@core/capture/parse";
import { routeDraft } from "@core/capture/route";
import { transcribeVoice } from "@core/voice";
import type { CommitResult } from "@core/capture/commit";
import { FakeLlmGateway, FakeVoiceProvider } from "../../providers/fake";
import { CANONICAL_CROSS_DOMAIN_DUMP } from "../../providers/fake/fixtures";

import { captureReducer, hasOnlyExplicitAutoCandidates } from "../src/features/capture/state";
import { createInitialCaptureState, type CaptureCommitRecord } from "../src/features/capture/types";

const CAPTURED_AT = "2026-07-21T05:15:00.000Z";

const committed: CommitResult = {
  commitId: "mobile-test-commit",
  status: "committed",
  entries: [],
  progressEffects: [],
  coachNoteId: null,
  undoExpiresAt: "2026-07-21T05:20:00.000Z",
};

async function canonicalDraft() {
  const result = await parseDump(
    { rawText: CANONICAL_CROSS_DOMAIN_DUMP, capturedAt: CAPTURED_AT, timezone: "Asia/Kolkata", source: "voice", transcriptConfidenceBps: 9800 },
    new FakeLlmGateway(),
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  return result.draft;
}

function expectOk<T extends { ok: boolean }>(result: T): asserts result is Extract<T, { ok: true }> {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected an ok result");
}

test("F3 safety: fake parse routes estimates and unknown water to review, never auto", async () => {
  const draft = await canonicalDraft();
  const routes = routeDraft(draft);
  const autoIds = new Set(routes.filter((route) => route.route === "auto").map((route) => route.proposalId));
  const estimates = draft.proposals.filter((proposal) => proposal.estimated);

  assert.equal(estimates.length, 2);
  assert.equal(estimates.every((proposal) => !autoIds.has(proposal.proposalId)), true);
  assert.equal(hasOnlyExplicitAutoCandidates(estimates), false);
});

test("F3 safety: reducer refuses an estimated auto-file transition", async () => {
  const draft = await canonicalDraft();
  const estimate = draft.proposals.find((proposal) => proposal.estimated);
  assert.equal(Boolean(estimate), true);
  if (!estimate) throw new Error("Canonical fixture must have an estimate");
  const prepared = captureReducer(createInitialCaptureState(draft.rawText), {
    type: "draft-prepared",
    draft,
    autoCandidates: [estimate],
    deck: [],
    questions: [],
  });

  assert.equal(prepared.phase, "error");
  assert.equal(prepared.filed.length, 0);
  assert.equal(/estimated/i.test(prepared.error?.message ?? ""), true);
});

test("voice stays transient until its fake transcript is visibly confirmed", async () => {
  const audio = { bytes: new Uint8Array([1]), mimeType: "audio/mp4" as const, durationMs: 400 };
  const outcome = await transcribeVoice(audio, new FakeVoiceProvider());
  expectOk(outcome);

  let state = captureReducer(createInitialCaptureState(), { type: "begin-transcription" });
  state = captureReducer(state, { type: "transcript-ready", text: outcome.transcription.text, confidenceBps: outcome.transcription.confidenceBps });

  assert.equal(state.phase, "transcript-confirm");
  assert.equal(state.draft, null);
  assert.equal(state.filed.length, 0);
  assert.equal(state.transcript, CANONICAL_CROSS_DOMAIN_DUMP);
});

test("discard removes only the card and produces no commit record", async () => {
  const draft = await canonicalDraft();
  const meal = draft.proposals.find((proposal) => proposal.kind === "meal");
  assert.equal(Boolean(meal), true);
  if (!meal) throw new Error("Canonical fixture must have a meal");
  let state = captureReducer(createInitialCaptureState(), {
    type: "draft-prepared",
    draft,
    autoCandidates: [],
    deck: [{ proposal: meal, reasons: ["estimated value must be confirmed"], question: null }],
    questions: [],
  });
  state = captureReducer(state, { type: "discard", proposalId: meal.proposalId });

  assert.equal(state.phase, "fanout");
  assert.equal(state.deck.length, 0);
  assert.equal(state.lastCommit, null);
  assert.equal(state.discardedCount, 1);
});

test("explicit accepted card enters fanout only after a confirmed commit result", async () => {
  const draft = await canonicalDraft();
  const meal = draft.proposals.find((proposal) => proposal.kind === "meal");
  assert.equal(Boolean(meal), true);
  if (!meal) throw new Error("Canonical fixture must have a meal");
  const record: CaptureCommitRecord = { commit: committed, proposalIds: [meal.proposalId], source: "accepted" };
  let state = captureReducer(createInitialCaptureState(), {
    type: "draft-prepared",
    draft,
    autoCandidates: [],
    deck: [{ proposal: meal, reasons: ["estimated value must be confirmed"], question: null }],
    questions: [],
  });
  state = captureReducer(state, { type: "accept-filed", proposal: meal, commit: record });

  assert.equal(state.phase, "fanout");
  assert.equal(state.accepted.length, 1);
  assert.equal(state.accepted[0]?.proposalId, meal.proposalId);
  assert.equal(state.lastCommit?.commit.commitId, committed.commitId);
});
