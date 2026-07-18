import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
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

  const { llm } = await getSession();
  const result = await parseDump(
    { rawText, timezone, capturedAt: new Date().toISOString(), source, transcriptConfidenceBps },
    llm,
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, retryable: result.retryable, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, draft: result.draft });
}
