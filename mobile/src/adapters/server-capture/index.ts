import { captureDraftSchema } from "@core/capture/contract";
import type { ParseDumpInput, ParseResult } from "@core/capture/parse";
import type { Transcription, VoiceAudio, VoiceProvider } from "@contracts";

type TokenSource = () => string | null;

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function headers(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Live parse runs on the server: only a Supabase access token and public base URL leave iOS. */
export class BearerCaptureParser {
  constructor(private readonly baseUrl: string, private readonly token: TokenSource) {}

  async parse(input: ParseDumpInput): Promise<ParseResult> {
    try {
      const response = await fetch(endpoint(this.baseUrl, "/api/capture/parse"), {
        method: "POST",
        headers: { ...headers(this.token()), "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.rawText, timezone: input.timezone, source: input.source, transcriptConfidenceBps: input.transcriptConfidenceBps }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; retryable?: boolean; error?: string; draft?: unknown } | null;
      if (!response.ok || !body?.ok) return { ok: false, retryable: true, error: body?.error ?? "capture server unavailable" };
      const checked = captureDraftSchema.safeParse(body.draft);
      if (!checked.success) return { ok: false, retryable: true, error: "capture server returned an invalid draft" };
      return {
        ok: true,
        draft: {
          ...checked.data,
          rawText: input.rawText,
          capturedAt: input.capturedAt,
          timezone: input.timezone,
          source: input.source ?? "text",
          transcriptConfidenceBps: input.transcriptConfidenceBps ?? null,
        },
      };
    } catch {
      return { ok: false, retryable: true, error: "capture server unavailable" };
    }
  }
}

/** Sends Expo's documented M4A/AAC output as `audio/mp4`; no model key reaches iOS. */
export class BearerVoiceProvider implements VoiceProvider {
  constructor(private readonly baseUrl: string, private readonly token: TokenSource) {}

  async transcribe(audio: VoiceAudio): Promise<Transcription> {
    const form = new FormData();
    const copied = new Uint8Array(audio.bytes.byteLength);
    copied.set(audio.bytes);
    const blob = new Blob([copied.buffer], { type: audio.mimeType });
    form.append("audio", blob, "capture.m4a");
    form.append("mimeType", audio.mimeType);
    form.append("durationMs", String(audio.durationMs));
    const response = await fetch(endpoint(this.baseUrl, "/api/capture/transcribe"), { method: "POST", headers: headers(this.token()), body: form });
    const body = await response.json().catch(() => null) as { ok?: boolean; transcription?: Transcription; error?: string } | null;
    if (!response.ok || !body?.ok || !body.transcription) throw new Error(body?.error ?? "transcription unavailable");
    return body.transcription;
  }
}
