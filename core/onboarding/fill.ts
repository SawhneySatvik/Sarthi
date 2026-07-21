/**
 * core/onboarding/fill.ts — SAR-012 Pass 1 (D-D). The voice-fill seam, a faithful
 * mirror of `core/capture/parse.ts::parseDump`: fast-tier structured fill via the
 * INJECTED `LlmGateway` (never imported concretely — the fake stack runs it keyless).
 *
 * A blank utterance, a gateway throw, OR an object that fails the question's field
 * schema all return a retryable result with ZERO fields — voice-fill NEVER writes and
 * has no side effects (invariant #1). The UI leaves the field empty + pulses the chips.
 */
import type { LlmGateway } from "@/core/contracts";

import { buildFillPrompt, voiceFillSchemas, type FillQuestionKey } from "./contract";

export type FillResult =
  | { ok: true; questionKey: FillQuestionKey; fields: Record<string, unknown> }
  | { ok: false; retryable: true; error: string };

export interface FillInput {
  questionKey: FillQuestionKey;
  text: string;
}

const SYSTEM_PROMPT = `Extract ONLY the requested onboarding field(s) from the user's spoken answer — nothing more. Use integer units (centimetres, grams, minutes) and compute exact integers for any value the user states. When a requested value is genuinely not spoken, leave it null — never invent it, infer beyond what was said, or fill unrelated fields. Return only the structured object for the requested field(s).`;

export async function fillAnswer(input: FillInput, llm: LlmGateway): Promise<FillResult> {
  if (input.text.trim().length === 0) {
    // Nothing to parse — no gateway call, no side effects.
    return { ok: false, retryable: true, error: "empty utterance" };
  }
  const schema = voiceFillSchemas[input.questionKey];
  try {
    const result = await llm.generateObject({
      tier: "fast",
      schema,
      system: SYSTEM_PROMPT,
      prompt: buildFillPrompt(input.questionKey, input.text),
      telemetry: { operation: "onboarding-fill" },
    });
    // Defensive re-validation: a malformed fill must NEVER enter the draft — it is a
    // retryable empty result, not a crash and not a silent write.
    const parsed = schema.safeParse(result.object);
    if (!parsed.success) {
      return { ok: false, retryable: true, error: "onboarding-fill returned fields that failed the question schema" };
    }
    return { ok: true, questionKey: input.questionKey, fields: parsed.data as Record<string, unknown> };
  } catch (error) {
    return { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error) };
  }
}
