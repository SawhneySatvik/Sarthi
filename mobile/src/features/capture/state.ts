import type { CaptureDraft, ClarificationQuestion, Proposal, ProposalDomain } from "@core/capture/contract";

import type { CaptureCard, CaptureCommitRecord, CaptureError, CaptureState } from "./types";

function uniqueQuestions(questions: readonly ClarificationQuestion[]): ClarificationQuestion[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    if (seen.has(question.questionId)) return false;
    seen.add(question.questionId);
    return true;
  });
}

function questionsStillNeeded(deck: readonly CaptureCard[], questions: readonly ClarificationQuestion[]): ClarificationQuestion[] {
  const proposalIds = new Set(deck.map((card) => card.proposal.proposalId));
  return questions.filter((question) => question.blocksProposalIds.some((proposalId) => proposalIds.has(proposalId)));
}

function removeCard(state: CaptureState, proposalId: string): Pick<CaptureState, "deck" | "questions" | "editingProposalId" | "whyProposalId"> {
  const deck = state.deck.filter((card) => card.proposal.proposalId !== proposalId);
  return {
    deck,
    questions: questionsStillNeeded(deck, state.questions),
    editingProposalId: state.editingProposalId === proposalId ? null : state.editingProposalId,
    whyProposalId: state.whyProposalId === proposalId ? null : state.whyProposalId,
  };
}

function phaseAfterDeckChange(deck: readonly CaptureCard[], questions: readonly ClarificationQuestion[]): CaptureState["phase"] {
  return deck.length === 0 && questions.length === 0 ? "fanout" : "confirm";
}

function replaceProposal(cards: readonly CaptureCard[], proposal: Proposal): CaptureCard[] {
  return cards.map((card) => (card.proposal.proposalId === proposal.proposalId ? { ...card, proposal } : card));
}

function guardAutoCandidates(candidates: readonly Proposal[]): CaptureError | null {
  if (candidates.some((proposal) => proposal.estimated)) {
    return { kind: "commit", retryable: false, message: "Safety check stopped an estimated value from filing automatically." };
  }
  return null;
}

function xpFromCommit(record: CaptureCommitRecord): number {
  return record.commit.progressEffects.reduce((total, effect) => total + effect.xpDelta, 0);
}

function levelledUpFromCommit(record: CaptureCommitRecord): boolean {
  return record.commit.progressEffects.some((effect) => effect.levelAfter > effect.levelBefore);
}

export type CaptureAction =
  | { type: "set-text"; rawText: string }
  | { type: "begin-recording" }
  | { type: "begin-transcription" }
  | { type: "transcript-ready"; text: string; confidenceBps: number | null }
  | { type: "set-transcript"; text: string }
  | { type: "begin-parse"; rawText: string; source: "text" | "voice" }
  | { type: "draft-prepared"; draft: CaptureDraft; autoCandidates: readonly Proposal[]; deck: readonly CaptureCard[]; questions: readonly ClarificationQuestion[] }
  | { type: "auto-filed"; commit: CaptureCommitRecord }
  | { type: "auto-file-failed"; error: CaptureError }
  | { type: "accept-filed"; proposal: Proposal; commit: CaptureCommitRecord }
  | { type: "accept-deferred"; proposalId: string; reason: string; question: ClarificationQuestion }
  | { type: "discard"; proposalId: string }
  | { type: "set-editing"; proposalId: string | null }
  | { type: "set-why"; proposalId: string | null }
  | { type: "replace-proposal"; proposal: Proposal }
  | { type: "set-domain"; proposalId: string; domain: ProposalDomain }
  | { type: "error"; error: CaptureError }
  | { type: "empty" }
  | { type: "undo-succeeded"; commitId: string; result: CaptureState["undoResult"] }
  | { type: "coach-line"; text: string | null }
  | { type: "reset"; rawText?: string };

/**
 * Pure native capture state machine. Provider/repository side effects happen in the
 * controller and this reducer receives only completed outcomes. Its guard makes the
 * F3 trust law independently testable: estimates never enter `filed` automatically.
 */
export function captureReducer(state: CaptureState, action: CaptureAction): CaptureState {
  switch (action.type) {
    case "set-text":
      return { ...state, rawText: action.rawText, error: state.error?.kind === "empty-input" ? null : state.error };
    case "begin-recording":
      return { ...state, phase: "recording", error: null };
    case "begin-transcription":
      return { ...state, phase: "transcribing", error: null };
    case "transcript-ready":
      return { ...state, phase: "transcript-confirm", source: "voice", rawText: action.text, transcript: action.text, transcriptConfidenceBps: action.confidenceBps, error: null };
    case "set-transcript":
      return { ...state, transcript: action.text, rawText: action.text };
    case "begin-parse":
      return {
        ...state,
        phase: "parsing",
        rawText: action.rawText,
        source: action.source,
        draft: null,
        autoCandidates: [],
        filed: [],
        deck: [],
        questions: [],
        accepted: [],
        discardedCount: 0,
        xpGained: 0,
        levelledUp: false,
        coachLine: null,
        editingProposalId: null,
        whyProposalId: null,
        error: null,
        lastCommit: null,
        undoResult: null,
      };
    case "draft-prepared": {
      const safetyError = guardAutoCandidates(action.autoCandidates);
      if (safetyError) return { ...state, phase: "error", error: safetyError };
      const questions = uniqueQuestions(action.questions);
      return { ...state, phase: action.autoCandidates.length > 0 ? "filing" : phaseAfterDeckChange(action.deck, questions), draft: action.draft, autoCandidates: action.autoCandidates, deck: action.deck, questions, error: null };
    }
    case "auto-filed": {
      const safetyError = guardAutoCandidates(state.autoCandidates);
      if (safetyError) return { ...state, phase: "error", error: safetyError };
      return {
        ...state,
        phase: phaseAfterDeckChange(state.deck, state.questions),
        filed: [...state.filed, ...state.autoCandidates],
        autoCandidates: [],
        lastCommit: action.commit,
        xpGained: state.xpGained + xpFromCommit(action.commit),
        levelledUp: state.levelledUp || levelledUpFromCommit(action.commit),
        error: null,
      };
    }
    case "auto-file-failed": {
      const deck = [
        ...state.autoCandidates.map((proposal): CaptureCard => ({ proposal, reasons: ["Could not file automatically. Review before trying again."], question: null })),
        ...state.deck,
      ];
      return { ...state, phase: "confirm", autoCandidates: [], deck, error: action.error };
    }
    case "accept-filed": {
      const remainder = removeCard(state, action.proposal.proposalId);
      const sameBatch = state.lastCommit?.commit.commitId === action.commit.commit.commitId;
      return {
        ...state,
        ...remainder,
        phase: phaseAfterDeckChange(remainder.deck, remainder.questions),
        accepted: [...state.accepted, action.proposal],
        lastCommit: action.commit,
        xpGained: state.xpGained + (sameBatch ? 0 : xpFromCommit(action.commit)),
        levelledUp: state.levelledUp || (sameBatch ? false : levelledUpFromCommit(action.commit)),
        error: null,
      };
    }
    case "accept-deferred": {
      const deck = state.deck.map((card) => card.proposal.proposalId === action.proposalId ? { ...card, reasons: [action.reason], question: action.question } : card);
      return { ...state, phase: "confirm", deck, questions: uniqueQuestions([...state.questions, action.question]) };
    }
    case "discard": {
      const remainder = removeCard(state, action.proposalId);
      return { ...state, ...remainder, phase: phaseAfterDeckChange(remainder.deck, remainder.questions), discardedCount: state.discardedCount + 1 };
    }
    case "set-editing":
      return { ...state, editingProposalId: action.proposalId, whyProposalId: action.proposalId ? null : state.whyProposalId };
    case "set-why":
      return { ...state, whyProposalId: action.proposalId, editingProposalId: action.proposalId ? null : state.editingProposalId };
    case "replace-proposal":
      return { ...state, deck: replaceProposal(state.deck, action.proposal) };
    case "set-domain": {
      const card = state.deck.find((candidate) => candidate.proposal.proposalId === action.proposalId);
      return card ? { ...state, deck: replaceProposal(state.deck, { ...card.proposal, domain: action.domain }) } : state;
    }
    case "error":
      return { ...state, phase: "error", error: action.error };
    case "empty":
      return { ...state, phase: "empty", error: { kind: "empty-draft", retryable: false, message: "Tell me what happened — a meal, a spend, a session, or a habit." } };
    case "undo-succeeded": {
      if (!state.lastCommit || state.lastCommit.commit.commitId !== action.commitId) return state;
      const ids = new Set(state.lastCommit.proposalIds);
      const filed = state.lastCommit.source === "auto" ? state.filed.filter((proposal) => !ids.has(proposal.proposalId)) : state.filed;
      const accepted = state.lastCommit.source === "accepted" ? state.accepted.filter((proposal) => !ids.has(proposal.proposalId)) : state.accepted;
      return { ...state, filed, accepted, lastCommit: null, undoResult: action.result };
    }
    case "coach-line":
      return { ...state, coachLine: action.text };
    case "reset":
      return { ...state, ...createResetState(action.rawText ?? "") };
  }
}

function createResetState(rawText: string): CaptureState {
  return {
    phase: "input", rawText, source: "text", transcript: "", transcriptConfidenceBps: null, draft: null,
    autoCandidates: [], filed: [], deck: [], questions: [], accepted: [], discardedCount: 0, xpGained: 0,
    levelledUp: false, coachLine: null, editingProposalId: null, whyProposalId: null, error: null, lastCommit: null, undoResult: null,
  };
}

export function hasOnlyExplicitAutoCandidates(candidates: readonly Proposal[]): boolean {
  return candidates.every((proposal) => !proposal.estimated && proposal.confidenceBps >= 9000);
}
