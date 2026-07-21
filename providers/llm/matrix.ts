import type { LlmProviderName, Tier } from "@/core/contracts";
import { ProviderConfigurationError } from "@/core/contracts/errors";

// Canonical taxonomy lives in core; re-export so existing `@/providers/llm` importers keep working.
export { ProviderConfigurationError };

export type EnabledLlmProviderName = Exclude<LlmProviderName, "anthropic">;
export type LlmModelId = string | null;

/**
 * Verified runtime model IDs. Google uses two free-tier models per the model plan:
 * `gemini-2.5-flash` (deep / reasoning) and `gemini-2.5-flash-lite` (light structured
 * work). `gemini-2.5-pro` is paid-only (since Apr 2026) and intentionally unused.
 */
export const VERIFIED_LLM_MODEL_IDS = Object.freeze({
  google: Object.freeze(["gemini-2.5-flash", "gemini-flash-lite-latest"]),
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
    // Model plan: deep = gemini-2.5-flash (reasoning — daily/weekly briefs, goal +
    // challenge planning, long/complex chat). balanced + fast = gemini-flash-lite-latest
    // (light structured work — capture parse, photo vision, voice-fill, short coaching).
    // NOTE: the pinned `gemini-2.5-flash-lite` is deprecated for new API keys; the
    // `-latest` alias tracks the current lite model and never 404s on a new key.
    deep: "gemini-2.5-flash",
    balanced: "gemini-flash-lite-latest",
    fast: "gemini-flash-lite-latest",
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
