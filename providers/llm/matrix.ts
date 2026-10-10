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
  // Listed by each provider's own `GET /v1/models` on 2026-10-10 (no guessing).
  nvidia: Object.freeze([
    "nvidia/nemotron-3-super-120b-a12b",
    "google/gemma-4-31b-it",
    "nvidia/nemotron-3.5-lightning-30b-a3b",
  ]),
  openrouter: Object.freeze(["nvidia/nemotron-3-super-120b-a12b:free"]),
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
  // NVIDIA NIM (OpenAI-compatible, https://integrate.api.nvidia.com/v1, key NVIDIA_API_KEY).
  // IDs picked 2026-10-10 from `GET /v1/models`: deep = Nemotron 3 Super (120B MoE, 12B
  // active) for reasoning-grade briefs; balanced = Gemma 4 31B instruct; fast = Nemotron 3.5
  // Lightning (30B MoE, 3B active) for capture parse / short structured work.
  nvidia: Object.freeze({
    deep: "nvidia/nemotron-3-super-120b-a12b",
    balanced: "google/gemma-4-31b-it",
    fast: "nvidia/nemotron-3.5-lightning-30b-a3b",
  }),
  // OpenRouter (OpenAI-compatible, https://openrouter.ai/api/v1, key OPENROUTER_API_KEY).
  // ID picked 2026-10-10 from `GET /api/v1/models` (`:free`, advertises `response_format` +
  // `structured_outputs`) and live-smoked OK. The Gemma 4 `:free` variants were listed but
  // returned 429 from the upstream shared pool that day, so every tier uses the one verified
  // free model. Free variants are rate-limited — fine for dev/delegation, not prod.
  openrouter: Object.freeze({
    deep: "nvidia/nemotron-3-super-120b-a12b:free",
    balanced: "nvidia/nemotron-3-super-120b-a12b:free",
    fast: "nvidia/nemotron-3-super-120b-a12b:free",
  }),
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
