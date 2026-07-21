import { NextResponse } from "next/server";

import { getSessionForRuntimeRequest, isBearerAuthenticationError, type Session } from "@/app/lib/session";
import { isRuntimeOverrideError } from "@/app/lib/runtimeOverride";
import { scrubProviderError, withByok } from "@/app/lib/byok";
import { parseDump } from "@/core/capture";

/*
 * POST /api/capture/parse (SAR-006, D-A) — the deep-tier parse seam.
 * Body: { text: string, timezone?: string }. Runs keyless on the fake stack
 * (FakeLlmGateway returns the canonical draft for any input). A failed parse is a
 * retryable 502 with ZERO rows — never a silent write (SAR-004 rule 1).
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    text?: unknown;
    timezone?: unknown;
    source?: unknown;
    transcriptConfidenceBps?: unknown;
  };
  const rawText = typeof body.text === "string" ? body.text : "";
  const timezone = typeof body.timezone === "string" ? body.timezone : "UTC";
  const source = body.source === "voice" ? "voice" : "text";
  const transcriptConfidenceBps =
    source === "voice" && Number.isInteger(body.transcriptConfidenceBps) &&
    (body.transcriptConfidenceBps as number) >= 0 && (body.transcriptConfidenceBps as number) <= 10_000
      ? (body.transcriptConfidenceBps as number)
      : null;

  let session: Session;
  try {
    session = await getSessionForRuntimeRequest(request);
  } catch (error) {
    if (isBearerAuthenticationError(error)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (isRuntimeOverrideError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    throw error;
  }
  // A per-request BYOK key (if present) overrides the configured provider for THIS parse.
  const { llm } = withByok(session, request);
  const result = await parseDump(
    { rawText, timezone, capturedAt: new Date().toISOString(), source, transcriptConfidenceBps },
    llm,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, retryable: result.retryable, error: scrubProviderError(result.error, request.headers) },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, draft: result.draft });
}
