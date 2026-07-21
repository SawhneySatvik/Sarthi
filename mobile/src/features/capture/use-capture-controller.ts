import { useCallback, useMemo, useReducer } from "react";

import { applyUserEdit, blockedProposalIds, isAcceptAllEligible, routeDraft } from "@core/capture/route";
import { parseDump } from "@core/capture/parse";
import { prepareDraft, resolveProposal } from "@core/capture/resolve";
import { transcribeVoice } from "@core/voice";
import type { Proposal, ProposalDomain } from "@core/capture/contract";
import type { VoiceAudio } from "@contracts";

import { captureReducer, hasOnlyExplicitAutoCandidates } from "./state";
import { createInitialCaptureState, type CaptureCard, type CaptureCommitRecord, type CaptureError, type CaptureRuntime } from "./types";

function captureError(kind: CaptureError["kind"], message: string, retryable = true): CaptureError {
  return { kind, message, retryable };
}

function commitRecord(
  result: Awaited<ReturnType<CaptureRuntime["commits"]["commit"]>>,
  proposalIds: readonly string[],
  source: CaptureCommitRecord["source"],
): CaptureCommitRecord {
  return { commit: result, proposalIds, source };
}

function cardsFromPrepared(pending: readonly { proposal: Proposal; reasons: readonly string[]; question: CaptureCard["question"] }[]): CaptureCard[] {
  return pending.map((card) => ({ proposal: card.proposal, reasons: card.reasons, question: card.question }));
}

/** Async facade over the pure state machine. */
export function useCaptureController(runtime: CaptureRuntime, initialText = "") {
  const [state, dispatch] = useReducer(captureReducer, initialText, createInitialCaptureState);

  const notify = useCallback(async (record: CaptureCommitRecord) => {
    try {
      await runtime.notifyCommitted?.(record.commit);
      const line = await runtime.getCoachLine?.(record.commit);
      if (line !== undefined) dispatch({ type: "coach-line", text: line });
    } catch {
      // Cache/coach readers are not allowed to resurrect already-confirmed cards.
    }
  }, [runtime]);

  const parse = useCallback(async (rawText: string, source: "text" | "voice", transcriptConfidenceBps: number | null = null) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      dispatch({ type: "error", error: captureError("empty-input", "Add what happened before sending it.", false) });
      return;
    }

    dispatch({ type: "begin-parse", rawText: trimmed, source });
    const parsed = await parseDump({ rawText: trimmed, capturedAt: runtime.now(), timezone: runtime.timezone(), source, transcriptConfidenceBps }, runtime.llm);
    if (!parsed.ok) {
      dispatch({ type: "error", error: captureError("parse", "Couldn't parse that. Retry, or file it as a note.") });
      return;
    }
    if (parsed.draft.proposals.length === 0) {
      dispatch({ type: "empty" });
      return;
    }

    const routed = routeDraft(parsed.draft);
    let prepared: Awaited<ReturnType<typeof prepareDraft>>;
    try {
      prepared = await prepareDraft(parsed.draft, runtime.repos);
    } catch {
      dispatch({ type: "error", error: captureError("parse", "Couldn't prepare that capture for review. Nothing was filed.") });
      return;
    }
    const routedAutoIds = new Set(routed.filter((item) => item.route === "auto").map((item) => item.proposalId));
    const preparedAutoIds = new Set(prepared.autoCommit.map((proposal) => proposal.proposalId));
    const preparedCandidates = parsed.draft.proposals.filter((proposal) => preparedAutoIds.has(proposal.proposalId));
    // Resolver may only demote. A surprising promotion becomes a pending card.
    const autoCandidates = preparedCandidates.filter((proposal) => routedAutoIds.has(proposal.proposalId));
    const safetyDemotions = preparedCandidates.filter((proposal) => !routedAutoIds.has(proposal.proposalId));
    const deck: CaptureCard[] = [
      ...cardsFromPrepared(prepared.pending),
      ...safetyDemotions.map((proposal) => ({ proposal, reasons: ["This item needs confirmation before it can be filed."], question: null })),
    ];
    const questions = [...parsed.draft.questions, ...prepared.pending.flatMap((card) => card.question ? [card.question] : [])];

    dispatch({ type: "draft-prepared", draft: parsed.draft, autoCandidates, deck, questions });
    if (autoCandidates.length === 0) return;
    if (!hasOnlyExplicitAutoCandidates(autoCandidates)) {
      dispatch({ type: "auto-file-failed", error: captureError("commit", "Safety check kept this capture in review. Nothing was filed.", false) });
      return;
    }

    try {
      const result = await runtime.commits.commit({
        draftId: parsed.draft.draftId,
        idempotencyKey: runtime.makeIdempotencyKey("auto"),
        kind: "capture",
        proposals: prepared.autoCommit.filter((proposal) => routedAutoIds.has(proposal.proposalId)),
      });
      const record = commitRecord(result, autoCandidates.map((proposal) => proposal.proposalId), "auto");
      dispatch({ type: "auto-filed", commit: record });
      void notify(record);
    } catch {
      dispatch({ type: "auto-file-failed", error: captureError("commit", "Couldn't file the explicit entries. Review them before trying again.") });
    }
  }, [notify, runtime]);

  const submitText = useCallback(async () => parse(state.rawText, "text"), [parse, state.rawText]);

  const transcribe = useCallback(async (audio: VoiceAudio) => {
    dispatch({ type: "begin-transcription" });
    const outcome = await transcribeVoice(audio, runtime.voice);
    if (!outcome.ok) {
      const message = outcome.error === "invalid-duration"
        ? "That recording is too long. Record a clip under 30 seconds."
        : "Couldn't transcribe that clip. Your recording is still here to retry.";
      dispatch({ type: "error", error: captureError("transcription", message) });
      return;
    }
    dispatch({ type: "transcript-ready", text: outcome.transcription.text, confidenceBps: outcome.transcription.confidenceBps });
  }, [runtime.voice]);

  const confirmTranscript = useCallback(async () => parse(state.transcript, "voice", state.transcriptConfidenceBps), [parse, state.transcript, state.transcriptConfidenceBps]);

  const accept = useCallback(async (proposal: Proposal) => {
    const outcome = await resolveProposal(proposal, runtime.repos, "accepted");
    if (!outcome.ok) {
      dispatch({ type: "accept-deferred", proposalId: proposal.proposalId, reason: outcome.reason, question: outcome.question });
      return;
    }
    try {
      const result = await runtime.commits.commit({ draftId: state.draft?.draftId, idempotencyKey: runtime.makeIdempotencyKey("accept"), kind: "tap", proposals: [outcome.resolved] });
      const record = commitRecord(result, [proposal.proposalId], "accepted");
      dispatch({ type: "accept-filed", proposal, commit: record });
      void notify(record);
    } catch {
      dispatch({ type: "error", error: captureError("commit", "Couldn't save that card. It is still waiting for your review.") });
    }
  }, [notify, runtime, state.draft?.draftId]);

  const acceptAll = useCallback(async () => {
    const proposals = state.deck.map((card) => card.proposal);
    if (!isAcceptAllEligible(proposals, blockedProposalIds({ questions: state.questions }))) return;
    const outcomes = await Promise.all(proposals.map((proposal) => resolveProposal(proposal, runtime.repos, "accepted")));
    for (const outcome of outcomes) {
      if (!outcome.ok) {
        const proposalId = outcome.question.blocksProposalIds[0];
        if (proposalId) dispatch({ type: "accept-deferred", proposalId, reason: outcome.reason, question: outcome.question });
      }
    }
    const resolved = outcomes.filter((outcome): outcome is Extract<typeof outcome, { ok: true }> => outcome.ok).map((outcome) => outcome.resolved);
    if (resolved.length === 0) return;
    try {
      const result = await runtime.commits.commit({ draftId: state.draft?.draftId, idempotencyKey: runtime.makeIdempotencyKey("accept-all"), kind: "capture", proposals: resolved });
      const acceptedIds = new Set(resolved.map((proposal) => proposal.proposalId));
      const record = commitRecord(result, [...acceptedIds], "accepted");
      for (const card of state.deck.filter((card) => acceptedIds.has(card.proposal.proposalId))) dispatch({ type: "accept-filed", proposal: card.proposal, commit: record });
      void notify(record);
    } catch {
      dispatch({ type: "error", error: captureError("commit", "Couldn't save those cards. They are still waiting for your review.") });
    }
  }, [notify, runtime, state.deck, state.draft?.draftId, state.questions]);

  const acceptEdited = useCallback(async (proposal: Proposal, patch: Record<string, unknown>) => {
    const edited = applyUserEdit(proposal, patch);
    dispatch({ type: "replace-proposal", proposal: edited });
    await accept(edited);
  }, [accept]);

  const undoLatest = useCallback(async () => {
    if (!state.lastCommit) return;
    try {
      const result = await runtime.commits.undoLatest({ commitId: state.lastCommit.commit.commitId, now: runtime.now() });
      dispatch({ type: "undo-succeeded", commitId: state.lastCommit.commit.commitId, result });
      await runtime.notifyUndone?.(result);
    } catch {
      dispatch({ type: "error", error: captureError("commit", "That undo is no longer available. The confirmed entry remains saved.", false) });
    }
  }, [runtime, state.lastCommit]);

  const retry = useCallback(async () => {
    if (state.source === "voice" && state.transcript) await parse(state.transcript, "voice", state.transcriptConfidenceBps);
    else await parse(state.rawText, "text");
  }, [parse, state.rawText, state.source, state.transcript, state.transcriptConfidenceBps]);

  const saveAsNote = useCallback(async () => {
    if (!runtime.saveAsNote || !state.rawText.trim()) return;
    await runtime.saveAsNote({ rawText: state.rawText, occurredAt: runtime.now(), timezone: runtime.timezone() });
    dispatch({ type: "reset" });
  }, [runtime, state.rawText]);

  return useMemo(() => ({
    state,
    setText: (rawText: string) => dispatch({ type: "set-text", rawText }),
    markRecording: () => dispatch({ type: "begin-recording" }),
    transcribe,
    setTranscript: (text: string) => dispatch({ type: "set-transcript", text }),
    submitText,
    confirmTranscript,
    accept,
    acceptAll,
    acceptEdited,
    discard: (proposalId: string) => dispatch({ type: "discard", proposalId }),
    setEditing: (proposalId: string | null) => dispatch({ type: "set-editing", proposalId }),
    setWhy: (proposalId: string | null) => dispatch({ type: "set-why", proposalId }),
    setDomain: (proposalId: string, domain: ProposalDomain) => dispatch({ type: "set-domain", proposalId, domain }),
    undoLatest,
    retry,
    saveAsNote,
    copyText: () => runtime.copyText?.(state.rawText),
    reset: (rawText?: string) => dispatch({ type: "reset", rawText }),
  }), [accept, acceptAll, acceptEdited, confirmTranscript, retry, runtime, saveAsNote, state, submitText, transcribe, undoLatest]);
}

export type CaptureController = ReturnType<typeof useCaptureController>;
