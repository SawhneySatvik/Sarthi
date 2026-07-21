import type { VoiceAudio, VoiceProvider, VoiceProviderName } from "@/core/contracts";
import { ProviderConfigurationError } from "@/core/contracts";

/**
 * Retains the VoiceProvider contract for deliberately deferred live adapters.
 * Composition can still serve text/photo requests; an actual transcription
 * attempt fails closed and never reads, forwards, or fabricates credentials.
 */
export class UnavailableVoiceProvider implements VoiceProvider {
  constructor(private readonly provider: Exclude<VoiceProviderName, "fake">) {}

  async transcribe(audio: VoiceAudio): Promise<never> {
    void audio;
    throw new ProviderConfigurationError(
      `Voice provider "${this.provider}" is selected but server transcription is not implemented. Use VOICE_PROVIDER=fake until a server-side adapter is configured.`,
    );
  }
}
