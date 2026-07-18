/**
 * core/voice/transcribe.ts — bounded, provider-blind STT use case (SAR-013).
 *
 * Transcription is intentionally transient: this module receives an injected port,
 * validates transport facts, and returns a retryable outcome. It has no repository,
 * commit, or framework dependency, so an STT failure cannot create persistent state.
 */
import type { Transcription, VoiceAudio, VoiceProvider } from "@/core/contracts";

/** A behavioural transport limit, shared by the recorder and server route. */
export const MAX_VOICE_DURATION_MS = 30_000;

export const VOICE_MIME_TYPES = ["audio/webm", "audio/wav", "audio/mpeg"] as const;
type VoiceMimeType = (typeof VOICE_MIME_TYPES)[number];

export type TranscriptionOutcome =
  | { ok: true; transcription: Transcription }
  | { ok: false; retryable: true; error: "invalid-mime" | "invalid-duration" | "provider-unavailable" };

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
  } catch {
    return { ok: false, retryable: true, error: "provider-unavailable" };
  }
}
