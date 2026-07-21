import type { LlmGateway, LlmProviderName } from "@/core/contracts";
import { FakeLlmGateway } from "@/providers/fake";
import { AiSdkLlmGateway } from "./ai-sdk";
import { ProviderConfigurationError } from "./matrix";

export {
  LLM_MODEL_MATRIX,
  ProviderConfigurationError,
  resolveLlmModelId,
  VERIFIED_LLM_MODEL_IDS,
} from "./matrix";

/**
 * Selects an adapter from a parsed server-side provider selector. `options.apiKey`
 * carries a transient per-request BYOK key: when present the live adapter is built
 * with that key instead of the server env key. Omitting it preserves the prior
 * behaviour exactly (env/default), so the keyless `fake` path is untouched.
 */
export function createLlmGateway(provider: LlmProviderName, options?: { apiKey?: string }): LlmGateway {
  if (provider === "fake") {
    return new FakeLlmGateway();
  }
  if (provider === "google" || provider === "openai") {
    return new AiSdkLlmGateway(provider, options?.apiKey);
  }
  throw new ProviderConfigurationError(
    "LLM provider \"anthropic\" is wired but disabled until a deployment-account model ID is verified.",
  );
}
