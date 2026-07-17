import type { LlmProviderName, Tier } from "@/core/contracts";

export type EnabledLlmProviderName = Exclude<LlmProviderName, "anthropic">;
export type LlmModelId = string | null;

/** Verified IDs, including OpenAI's approved deep-tier alias. */
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
    deep: "gemini-2.5-pro",
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

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}

export function resolveLlmModelId(provider: LlmProviderName, tier: Tier): string {
  const modelId = LLM_MODEL_MATRIX[provider][tier];
  if (modelId === null) {
    throw new ProviderConfigurationError(
      `LLM provider \"${provider}\" is disabled: no verified runtime model ID is configured for tier \"${tier}\".`,
    );
  }
  return modelId;
}
