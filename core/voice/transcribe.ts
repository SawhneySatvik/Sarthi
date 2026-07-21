/**
 * core/voice/transcribe.ts — bounded, provider-blind STT use case (SAR-013).
 *
 * Transcription is intentionally transient: this module receives an injected port,
 * validates transport facts, and returns a retryable outcome. It has no repository,
 * commit, or framework dependency, so an STT failure cannot create persistent state.
 */
import { ProviderConfigurationError, type Transcription, type VoiceAudio, type VoiceProvider } from "@/core/contracts";

/** A behavioural transport limit, shared by the recorder and server route. */
export const MAX_VOICE_DURATION_MS = 30_000;

/**
 * `audio/mp4` is emitted by iOS recorders such as Expo AV. It is a transport
 * allowance only: providers still receive the same bounded `VoiceAudio` port.
 */
export const VOICE_MIME_TYPES = ["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4"] as const;
type VoiceMimeType = (typeof VOICE_MIME_TYPES)[number];

export type TranscriptionOutcome =
  | { ok: true; transcription: Transcription }
  | {
      ok: false;
      retryable: true;
      error: "invalid-mime" | "invalid-duration" | "provider-unavailable" | "provider-not-configured";
    };

export function isVoiceMimeType(value: string): value is VoiceMimeType {
  return (VOICE_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Validate before calling the provider. A caller may have deserialised untrusted
 * multipart data, so the runtime checks deliberately repeat the narrower port type.
 */
export async function transcribeVoice(
  audio: VoiceAudio,
  voice: VoiceProvider,
): Promise<TranscriptionOutcome> {
  if (!isVoiceMimeType(audio.mimeType)) {
    return { ok: false, retryable: true, error: "invalid-mime" };
  }
  if (!Number.isSafeInteger(audio.durationMs) || audio.durationMs < 1 || audio.durationMs > MAX_VOICE_DURATION_MS) {
    return { ok: false, retryable: true, error: "invalid-duration" };
  }

  try {
    return { ok: true, transcription: await voice.transcribe(audio) };
  } catch (error) {
    // An intentionally deferred live adapter is a configuration/capability gap,
    // not a fabricated transcript or a generic provider outage. The caller can
    // surface this safely without learning any provider credential details.
    if (error instanceof ProviderConfigurationError) {
      return { ok: false, retryable: true, error: "provider-not-configured" };
    }
    return { ok: false, retryable: true, error: "provider-unavailable" };
  }
}
