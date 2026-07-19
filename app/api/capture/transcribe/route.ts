import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
import { isVoiceMimeType, transcribeVoice } from "@/core/voice";

/** POST /api/capture/transcribe — transient, provider-blind STT (SAR-013). */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const mimeType = form?.get("mimeType");
  const durationMs = form?.get("durationMs");

  if (!(audio instanceof File) || typeof mimeType !== "string" || typeof durationMs !== "string") {
    return NextResponse.json({ ok: false, retryable: true, error: "invalid-audio" }, { status: 400 });
  }
  // Exact decimal parsing prevents coercion ("1.5", "1e3", whitespace) and the
  // declared MIME must agree with the browser-owned File MIME.
  if (!/^(?:0|[1-9][0-9]*)$/.test(durationMs) || !isVoiceMimeType(mimeType) || audio.type !== mimeType) {
    return NextResponse.json({ ok: false, retryable: true, error: "invalid-audio" }, { status: 400 });
  }

  const duration = Number(durationMs);
  const { voice } = await getSession();
  const outcome = await transcribeVoice(
    { bytes: new Uint8Array(await audio.arrayBuffer()), mimeType, durationMs: duration },
    voice,
  );
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : outcome.error === "provider-unavailable" ? 502 : 400 });
}
