import { createCommitService } from "@core/capture/commit";
import type { CommitService } from "@core/capture/commit";
import type { LlmGateway, UserScopedRepositories, VoiceProvider } from "@contracts";

import type { CaptureRuntime } from "./types";

export interface CreateCaptureRuntimeInput {
  readonly repos: UserScopedRepositories;
  readonly llm: LlmGateway;
  readonly voice: VoiceProvider;
  readonly now: () => string;
  readonly timezone: () => string;
  readonly makeIdempotencyKey: CaptureRuntime["makeIdempotencyKey"];
  readonly commits?: Pick<CommitService, "commit" | "undoLatest">;
  readonly notifyCommitted?: CaptureRuntime["notifyCommitted"];
  readonly getCoachLine?: CaptureRuntime["getCoachLine"];
  readonly notifyUndone?: CaptureRuntime["notifyUndone"];
  readonly saveAsNote?: CaptureRuntime["saveAsNote"];
  readonly copyText?: CaptureRuntime["copyText"];
}

/**
 * Core composition without an adapter dependency. Call this only from a mobile
 * composition root after it has selected the user-scoped repository bridge.
 */
export function createCaptureRuntime(input: CreateCaptureRuntimeInput): CaptureRuntime {
  return {
    repos: input.repos,
    llm: input.llm,
    voice: input.voice,
    commits: input.commits ?? createCommitService({ repos: input.repos, llm: input.llm, now: input.now }),
    now: input.now,
    timezone: input.timezone,
    makeIdempotencyKey: input.makeIdempotencyKey,
    ...(input.notifyCommitted ? { notifyCommitted: input.notifyCommitted } : {}),
    ...(input.getCoachLine ? { getCoachLine: input.getCoachLine } : {}),
    ...(input.notifyUndone ? { notifyUndone: input.notifyUndone } : {}),
    ...(input.saveAsNote ? { saveAsNote: input.saveAsNote } : {}),
    ...(input.copyText ? { copyText: input.copyText } : {}),
  };
}
