import type { CommitResult, CommitService, UndoResult } from "@core/capture/commit";
import type { CaptureDraft, ClarificationQuestion, Proposal, ProposalDomain } from "@core/capture/contract";
import type { ParseDumpInput, ParseResult } from "@core/capture/parse";
import type { LlmGateway, UserScopedRepositories, VisionProvider, VoiceProvider } from "@contracts";

/**
 * The only dependency the feature has on app composition. The local SQLite/store
 * layer supplies this object; capture never imports a database, auth client, or
 * provider factory itself.
 */
export interface CaptureRuntime {
  readonly llm: LlmGateway;
  readonly voice: VoiceProvider;
  readonly vision?: VisionProvider;
  /** Production may send parsing to the bearer-authenticated server; fake stays on-device. */
  readonly parse?: (input: ParseDumpInput) => Promise<ParseResult>;
  readonly repos: UserScopedRepositories;
  readonly commits: Pick<CommitService, "commit" | "undoLatest">;
  readonly timezone: () => string;
  readonly now: () => string;
  /** One stable key per deliberate commit attempt; retries reuse the same key. */
  readonly makeIdempotencyKey: (scope: "auto" | "accept" | "accept-all") => string;
  /** Store bridge, invoked only after a confirmed typed commit. */
  readonly notifyCommitted?: (result: CommitResult) => void | Promise<void>;
  /** Read the persisted fast-tier coach response after a confirmed batch. */
  readonly getCoachLine?: (result: CommitResult) => Promise<string | null>;
  /** Store bridge for the compensating undo. */
  readonly notifyUndone?: (result: UndoResult) => void | Promise<void>;
  /** Optional parse-error escape hatch. It writes only a CoachNote, never a typed entry. */
  readonly saveAsNote?: (input: { rawText: string; occurredAt: string; timezone: string }) => Promise<void>;
  /** Optional clipboard bridge: capture does not import a native clipboard package. */
  readonly copyText?: (text: string) => void | Promise<void>;
}

export type CapturePhase =
  | "input"
  | "recording"
  | "transcribing"
  | "transcript-confirm"
  | "parsing"
  | "filing"
  | "confirm"
  | "fanout"
  | "empty"
  | "error";

export type CaptureErrorKind = "empty-input" | "transcription" | "parse" | "commit" | "empty-draft";

export interface CaptureCard {
  readonly proposal: Proposal;
  readonly reasons: readonly string[];
  readonly question: ClarificationQuestion | null;
}

export interface CaptureError {
  readonly kind: CaptureErrorKind;
  readonly message: string;
  readonly retryable: boolean;
}

export interface CaptureCommitRecord {
  readonly commit: CommitResult;
  readonly proposalIds: readonly string[];
  readonly source: "auto" | "accepted";
}

/** In-memory only: drafts/transcripts/cards are never persistence rows. */
export interface CaptureState {
  readonly phase: CapturePhase;
  readonly rawText: string;
  readonly source: "text" | "voice" | "photo";
  readonly transcript: string;
  readonly transcriptConfidenceBps: number | null;
  readonly draft: CaptureDraft | null;
  readonly autoCandidates: readonly Proposal[];
  readonly filed: readonly Proposal[];
  readonly deck: readonly CaptureCard[];
  readonly questions: readonly ClarificationQuestion[];
  readonly accepted: readonly Proposal[];
  readonly discardedCount: number;
  readonly xpGained: number;
  readonly levelledUp: boolean;
  readonly coachLine: string | null;
  readonly editingProposalId: string | null;
  readonly whyProposalId: string | null;
  readonly error: CaptureError | null;
  readonly lastCommit: CaptureCommitRecord | null;
  readonly undoResult: UndoResult | null;
}

export const CAPTURE_DOMAINS: readonly ProposalDomain[] = ["health", "money", "habits", "skills"] as const;

export function createInitialCaptureState(rawText = ""): CaptureState {
  return {
    phase: "input",
    rawText,
    source: "text",
    transcript: "",
    transcriptConfidenceBps: null,
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
}
