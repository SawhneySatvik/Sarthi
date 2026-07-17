import type { Transcription, VoiceAudio, VoiceProvider } from "@/core/contracts";
import { CANONICAL_TRANSCRIPTION_FIXTURE } from "./fixtures";

export class FakeVoiceProvider implements VoiceProvider {
  async transcribe(audio: VoiceAudio, options?: { languageHint?: string }): Promise<Transcription> {
    void audio;
    void options;
    return {
      text: CANONICAL_TRANSCRIPTION_FIXTURE.text,
      confidenceBps: CANONICAL_TRANSCRIPTION_FIXTURE.confidenceBps,
      languageCode: CANONICAL_TRANSCRIPTION_FIXTURE.languageCode,
    };
  }
}
