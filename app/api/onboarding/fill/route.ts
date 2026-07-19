import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
import { fillAnswer, fillQuestionKeyEnum } from "@/core/onboarding";

/*
 * POST /api/onboarding/fill (SAR-012, D-D) — the voice-fill seam. Body:
 * { questionKey, text }. Runs keyless on the fake stack (deterministic canned fields
 * per question). A blank/unparseable utterance or a gateway failure is a retryable 502
 * with ZERO fields — never a silent write (invariant #1); the caller keeps the field
 * empty and pulses the chips. Mirrors /api/capture/parse: zero side effects on failure.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { questionKey?: unknown; text?: unknown };
  const key = fillQuestionKeyEnum.safeParse(body.questionKey);
  if (!key.success) {
    return NextResponse.json({ ok: false, retryable: false, error: "unknown questionKey" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";

  const { llm } = await getSession();
  const result = await fillAnswer({ questionKey: key.data, text }, llm);

  if (!result.ok) {
    return NextResponse.json({ ok: false, retryable: result.retryable, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, questionKey: result.questionKey, fields: result.fields });
}
