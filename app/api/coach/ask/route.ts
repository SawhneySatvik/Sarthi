import { NextResponse } from "next/server";
import { z } from "zod";

import { coachForSession } from "@/app/lib/coach";
import { getSessionForRuntimeRequest } from "@/app/lib/session";
import { isRuntimeOverrideError } from "@/app/lib/runtimeOverride";
import { scrubProviderError, withByok } from "@/app/lib/byok";

const requestSchema = z.object({ text: z.string().trim().min(1).max(2000), timezone: z.string().min(1).max(100) });

/** Session-only v1 ask: no message rows or arbitrary action payloads persist. */
export async function POST(request: Request): Promise<Response> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid coach question" }, { status: 400 });
  let session;
  try {
    session = withByok(await getSessionForRuntimeRequest(request), request);
  } catch (error) {
    if (isRuntimeOverrideError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    throw error;
  }
  try {
    const answer = await coachForSession(session).ask(parsed.data);
    return NextResponse.json({ ok: true, answer });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        retryable: true,
        error: scrubProviderError(error instanceof Error ? error.message : "coach unavailable", request.headers),
      },
      { status: 502 },
    );
  }
}
