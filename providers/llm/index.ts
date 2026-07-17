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

/** Selects an adapter from a parsed server-side provider selector. */
export function createLlmGateway(provider: LlmProviderName): LlmGateway {
  if (provider === "fake") {
    return new FakeLlmGateway();
  }
  if (provider === "google" || provider === "openai") {
    return new AiSdkLlmGateway(provider);
  }
  throw new ProviderConfigurationError(
    "LLM provider \"anthropic\" is wired but disabled until a deployment-account model ID is verified.",
  );
}
