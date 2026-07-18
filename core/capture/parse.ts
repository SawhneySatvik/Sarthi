/**
 * core/capture/parse.ts — `parseDump` (SAR-004, §5.1 rule 1).
 *
 * Deep-tier structured parse via the INJECTED `LlmGateway` (never imported
 * concretely — the fake stack runs it keylessly). A gateway throw OR an object
 * that fails the `CaptureDraft` schema returns a retryable draft with ZERO rows
 * and zero outbox — a failed parse never creates anything (`provider-failure`).
 */
import type { LlmGateway } from "@/core/contracts";

import { captureDraftSchema, type CaptureDraft, type CaptureSource } from "./contract";

export type ParseResult =
  | { ok: true; draft: CaptureDraft }
  | { ok: false; retryable: true; error: string };

export interface ParseDumpInput {
  rawText: string;
  timezone: string;
  capturedAt: string;
  source?: CaptureSource;
  /** STT confidence is transport metadata, never model-authored draft content. */
  transcriptConfidenceBps?: number | null;
}

const SYSTEM_PROMPT =
  "Parse the spoken life-log into a typed CaptureDraft of proposals across health, money, habits, and skills. " +
  "Use integer units (paise, millilitres, minutes, grams, kcal). Mark any estimate as estimated; when a value is " +
  "genuinely unknown, leave it null and raise a clarification question — never invent a value.";

export async function parseDump(input: ParseDumpInput, llm: LlmGateway): Promise<ParseResult> {
  try {
    const result = await llm.generateObject({
      tier: "deep",
      schema: captureDraftSchema,
      system: SYSTEM_PROMPT,
      prompt: `Captured at ${input.capturedAt} (${input.timezone}), source ${input.source ?? "text"}: ${input.rawText}`,
      telemetry: { operation: "capture-parse" },
    });
    // Defensive re-validation: even though the gateway is contracted to validate,
    // a malformed object (or a null primary quantity) must NEVER become rows — it is
    // a retryable draft, not a crash and not a silent write.
    const parsed = captureDraftSchema.safeParse(result.object);
    if (!parsed.success) {
      return { ok: false, retryable: true, error: "capture-parse returned an object that failed the CaptureDraft schema" };
    }
    // The gateway owns proposals/questions only. Transport facts are supplied by the
    // trusted caller and must override any model-authored values in its object.
    return {
      ok: true,
      draft: {
        ...parsed.data,
        rawText: input.rawText,
        capturedAt: input.capturedAt,
        timezone: input.timezone,
        source: input.source ?? "text",
        transcriptConfidenceBps: input.transcriptConfidenceBps ?? null,
      },
    };
  } catch (error) {
    return { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error) };
  }
}
