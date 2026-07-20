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

const SYSTEM_PROMPT = `You are Sarthi's capture parser. Turn one messy spoken life-log into a typed CaptureDraft — a set of proposals spanning Health, Money, Habits, and Skills. A single sentence often yields several proposals across different domains; capture each distinct thing the user mentioned.

UNITS — always integers, never floats or strings: money in paise (rupees × 100, e.g. ₹340 → 34000, ₹1.50 → 150), volume in millilitres, time in minutes, mass in grams, energy in kcal.

VALUES:
- For any amount the user STATES explicitly, compute and fill the exact integer. Never leave a stated value null.
- For a quantity that is estimable but unstated (e.g. a meal's kcal/macros from the food named), give your best integer estimate and set estimated:true.
- Use null ONLY for a field genuinely unknowable from the input, and then add a short clarification question. Never invent a value you have no basis for, and never silently guess an explicit figure.

Each proposal must match its domain's payload exactly. Be literal and grounded: parse only what the user said or a reasonable estimate of it — add no entries, advice, or plans. Return only the structured object.`;

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
