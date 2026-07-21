import type { VoiceProvider, VoiceProviderName } from "@/core/contracts";
import { FakeVoiceProvider } from "@/providers/fake";
import { UnavailableVoiceProvider } from "./unavailable";

/**
 * Only fake voice is callable today. Live selections remain provider-shaped so
 * they fail explicitly at the transcription capability, rather than breaking
 * unrelated request/session composition or causing a client-key workaround.
 */
export function createVoiceProvider(provider: VoiceProviderName): VoiceProvider {
  if (provider === "fake") {
    return new FakeVoiceProvider();
  }
  return new UnavailableVoiceProvider(provider);
}
