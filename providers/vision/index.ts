import type { VisionProvider, VisionProviderName } from "@/core/contracts";
import { FakeVisionProvider } from "@/providers/fake";
import { AiSdkVisionProvider } from "./ai-sdk";

/**
 * Selects a vision adapter. `options.apiKey` carries a transient per-request BYOK key so
 * strangers on the live deploy can parse photos with their own Gemini/OpenAI key; when
 * omitted the live adapter falls back to the server env key. The keyless `fake` path is
 * unchanged and needs no key.
 */
export function createVisionProvider(
  provider: VisionProviderName,
  options?: { apiKey?: string },
): VisionProvider {
  if (provider === "fake") {
    return new FakeVisionProvider();
  }
  return new AiSdkVisionProvider(provider, options?.apiKey);
}
