/**
 * core/onboarding/generate.ts — SAR-012 Pass 2 (D-E). `generateSpine`, a faithful
 * mirror of `core/capture/parse.ts::parseDump`: ONE deep-tier structured call per domain
 * via the INJECTED `LlmGateway` (never imported concretely — the fake stack runs it
 * keyless). The answers ride in a fenced JSON envelope the fake reads back to run
 * `deriveSpine`, so the keyless spine varies with the answers.
 *
 * A gateway throw OR an object that fails the domain spine schema returns a retryable
 * result — a failed generation is a per-domain retry skeleton (§10), never a bad plan.
 */
import type { LlmGateway } from "@/core/contracts";

import type { CoreAnswers } from "./contract";
import { buildSpinePrompt, spineSchemaFor, type DomainSpine, type SpineDomain } from "./spine";

export type GenerateSpineResult =
  | { ok: true; spine: DomainSpine }
  | { ok: false; retryable: true; error: string };

export interface GenerateSpineInput {
  domain: SpineDomain;
  answers: CoreAnswers;
}

const SYSTEM_PROMPT = `You are Sarthi, drafting a starter plan spine for ONE life domain from the user's onboarding answers. Derive every target directly from what they told you — time budget, day shape, wake/sleep, stated goals, age, body, income. Ground each item in a specific answer; do not impose generic defaults they did not imply.

Use integer units only: kcal, millilitres, minutes, grams, integer paise (rupees × 100). Keep it a SMALL, realistic, reviewable starting point (a handful of items) the user can edit — a gentle first step, never a finished or aggressive prescription. Match the domain schema exactly and return only the structured object.`;

export async function generateSpine(input: GenerateSpineInput, llm: LlmGateway): Promise<GenerateSpineResult> {
  const schema = spineSchemaFor(input.domain);
  try {
    const result = await llm.generateObject({
      tier: "deep",
      schema,
      system: SYSTEM_PROMPT,
      prompt: buildSpinePrompt(input.domain, input.answers),
      telemetry: { operation: "onboarding-spine" },
    });
    // Defensive re-validation: a malformed spine must NEVER become a plan — it is a
    // retryable skeleton, not a crash and not a silent write.
    const parsed = schema.safeParse(result.object);
    if (!parsed.success) {
      return { ok: false, retryable: true, error: "onboarding-spine returned a spine that failed the domain schema" };
    }
    return { ok: true, spine: parsed.data as DomainSpine };
  } catch (error) {
    return { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error) };
  }
}
