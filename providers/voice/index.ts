import type { VoiceProvider, VoiceProviderName } from "@/core/contracts";
import { FakeVoiceProvider } from "@/providers/fake";
import { ProviderConfigurationError } from "@/providers/llm";

/** Only fake voice is callable in SAR-002; live adapters retain the same port for later tickets. */
export function createVoiceProvider(provider: VoiceProviderName): VoiceProvider {
  if (provider === "fake") {
    return new FakeVoiceProvider();
  }
  throw new ProviderConfigurationError(`Voice provider \"${provider}\" is not implemented in SAR-002.`);
}
