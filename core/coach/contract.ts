import { z } from "zod";

import type { CommitService, CommitResult } from "@/core/capture";
import type { ProposalKind } from "@/core/capture/contract";
import type { LlmGateway, UserScopedRepositories } from "@/core/contracts";
import type { AdaptationRecord, CoachEvidence, CoachMessageRecord, CoachNoteRecord, Domain } from "@/data/schema/contract";

import type { ProposedAdaptationIntent as CoachAdaptationIntent } from "./agent";

export interface DateRange {
  start: string;
  end: string;
}

export interface CoachEvidenceItem {
  domain: Exclude<Domain, "overall">;
  entryKind: string;
  entryId: string | null;
  label: string;
  valueInt: number | null;
  unit: string | null;
}

export interface DomainCoachContext {
  domain: Exclude<Domain, "overall">;
  entryCount: number;
  evidence: readonly CoachEvidenceItem[];
}

export type CoachToolName = "read-domain-evidence" | "read-progress" | "read-plan" | "propose-adaptation";

export interface DomainEvent {
  domain: Exclude<Domain, "overall">;
  entryKind: string;
  entryId: string;
  localDate: string;
}

/** A read-only, typed view of a domain's eligible plan effects. */
export interface PlanEffect {
  planItemId: string;
  domain: Exclude<Domain, "overall">;
  status: "pending" | "active" | "done" | "skipped" | "missed";
  completionSource: string | null;
}

export interface DomainSpec {
  domain: Exclude<Domain, "overall">;
  proposalKinds: readonly ProposalKind[];
  parseHints: string;
  coachInstructions: string;
  contextLoader: (repos: UserScopedRepositories, range: DateRange) => Promise<DomainCoachContext>;
  allowedTools: readonly CoachToolName[];
  evaluatePlanEffects: (input: DomainEvent, repos: UserScopedRepositories) => Promise<readonly PlanEffect[]>;
}

export const coachBriefOutputSchema = z.object({
  scope: z.enum(["daily", "weekly"]),
  text: z.string().min(1).max(2000),
});
export type CoachBriefOutput = z.infer<typeof coachBriefOutputSchema>;

export interface CoachEngine {
  captureLine(input: { commit: CommitResult; domains: readonly Exclude<Domain, "overall">[] }): Promise<string>;
  dailyBrief(input: { localDate: string; timezone: string }): Promise<CoachNoteRecord>;
  weeklyBrief(input: { weekStart: string; timezone: string }): Promise<CoachNoteRecord>;
  /**
   * COACH-2 — the grounded, persistent replacement for the ungrounded single-turn `ask`.
   * Assembles memory (all pinned + top-K frecency for the turn's detected domains) + the
   * last-12 `coach_messages` buffer into the agent envelope, persists both turns, and
   * returns the persisted coach message plus a validated adaptation intent (row creation
   * is COACH-3). `localDate` is server-derived from the profile timezone (D-053).
   */
  converse(input: { text: string; timezone: string; localDate: string }): Promise<{
    message: CoachMessageRecord;
    proposedAdaptation: CoachAdaptationIntent | null;
  }>;
  proposeAdaptation(input: {
    planItemId: string;
    before: AdaptationRecord["beforeJson"];
    after: AdaptationRecord["afterJson"];
    reason: string;
  }): Promise<AdaptationRecord>;
  ensureReentryAdaptation(input: { localDate: string }): Promise<AdaptationRecord | null>;
  findReentryAdaptation(input: { localDate: string }): Promise<AdaptationRecord | null>;
  resolveAdaptation(input: { adaptationId: string; action: "keep" | "revert" }): Promise<AdaptationRecord>;
  gameSummary(input: { localDate: string }): Promise<import("@/core/game").GameSummary>;
}

export interface CreateCoachEngineOptions {
  repos: UserScopedRepositories;
  llm: LlmGateway;
  commits: CommitService;
  now?: () => string;
  /**
   * The verified caller identity — used only as the per-user single-flight key for
   * `converse` (COACH-2). Optional so scripts/tests can build an engine without a
   * session; the loop then falls back to the scoped-repos identity (per-instance).
   */
  userId?: string;
}

export function toCoachEvidence(localDate: string, items: readonly CoachEvidence["items"][number][]): CoachEvidence {
  return {
    generatedForLocalDate: localDate,
    items: items.map((item) => ({ ...item })),
  };
}

/** COACH-0 — the agentic loop's public types live in `./agent`; re-exported here so the
 *  coach barrel surfaces them (type-only, erased at runtime — no module cycle). */
export type {
  CoachAgentStep,
  CoachAgentEnvelope,
  CoachAgentMemory,
  CoachAgentMemories,
  CoachMemoryDomain,
  CoachAgentTranscriptMessage,
  AgentEvidenceEntry,
  AgentToolLogEntry,
  CoachCitation,
  ProposedAdaptationIntent,
  RunCoachAgentOptions,
  CoachAgentResult,
} from "./agent";
