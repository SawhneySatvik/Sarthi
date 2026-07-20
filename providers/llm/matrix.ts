import type { LlmProviderName, Tier } from "@/core/contracts";
import { ProviderConfigurationError } from "@/core/contracts/errors";

// Canonical taxonomy lives in core; re-export so existing `@/providers/llm` importers keep working.
export { ProviderConfigurationError };

export type EnabledLlmProviderName = Exclude<LlmProviderName, "anthropic">;
export type LlmModelId = string | null;

/**
 * Verified IDs, including OpenAI's approved deep-tier alias.
 * `gemini-2.5-pro` remains a real, verified ID but is PAID-only (since Apr 2026),
 * so the runtime matrix no longer maps any tier to it — the free-tier trio
 * (`gemini-2.5-flash` / `gemini-2.5-flash-lite`) covers deep/balanced/fast.
 */
export const VERIFIED_LLM_MODEL_IDS = Object.freeze({
  google: Object.freeze(["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]),
  openai: Object.freeze(["gpt-5.6-sol", "gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna"]),
});

/** The only runtime model IDs approved by the signed architecture. */
export const LLM_MODEL_MATRIX: Readonly<Record<LlmProviderName, Readonly<Record<Tier, LlmModelId>>>> = Object.freeze({
  fake: Object.freeze({
    deep: "fake-deep-v1",
    balanced: "fake-balanced-v1",
    fast: "fake-fast-v1",
  }),
  google: Object.freeze({
    // deep remapped off gemini-2.5-pro (PAID-only since Apr 2026) to the free,
    // multimodal 2.5-flash — adequate for structured capture parse.
    deep: "gemini-2.5-flash",
    balanced: "gemini-2.5-flash",
    fast: "gemini-2.5-flash-lite",
  }),
  openai: Object.freeze({
    deep: "gpt-5.6-sol",
    balanced: "gpt-5.6-terra",
    fast: "gpt-5.6-luna",
  }),
  anthropic: Object.freeze({ deep: null, balanced: null, fast: null }),
});

export function resolveLlmModelId(provider: LlmProviderName, tier: Tier): string {
  const modelId = LLM_MODEL_MATRIX[provider][tier];
  if (modelId === null) {
    throw new ProviderConfigurationError(
      `LLM provider \"${provider}\" is disabled: no verified runtime model ID is configured for tier \"${tier}\".`,
    );
  }
  return modelId;
}
