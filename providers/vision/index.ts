import type { VisionProvider, VisionProviderName } from "@/core/contracts";
import { FakeVisionProvider } from "@/providers/fake";
import { ProviderConfigurationError } from "@/providers/llm";

/** Only fake vision is callable in SAR-002; live adapters retain the same port for later tickets. */
export function createVisionProvider(provider: VisionProviderName): VisionProvider {
  if (provider === "fake") {
    return new FakeVisionProvider();
  }
  throw new ProviderConfigurationError(`Vision provider \"${provider}\" is not implemented in SAR-002.`);
}
