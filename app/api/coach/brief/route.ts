import { NextResponse } from "next/server";
import { z } from "zod";

import { coachForSession } from "@/app/lib/coach";
import { getSessionForRuntimeRequest } from "@/app/lib/session";
import { isRuntimeOverrideError } from "@/app/lib/runtimeOverride";

const requestSchema = z.object({
  scope: z.enum(["daily", "weekly"]),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(100),
});

/** Generates/reuses a staleness-keyed, tenant-scoped Coach note. */
export async function POST(request: Request): Promise<Response> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid brief request" }, { status: 400 });
  let session;
  try {
    session = await getSessionForRuntimeRequest(request);
  } catch (error) {
    if (isRuntimeOverrideError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    throw error;
  }
  const engine = coachForSession(session);
  try {
    const note = parsed.data.scope === "daily"
      ? await engine.dailyBrief({ localDate: parsed.data.localDate, timezone: parsed.data.timezone })
      : await engine.weeklyBrief({ weekStart: parsed.data.localDate, timezone: parsed.data.timezone });
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    return NextResponse.json(
      { ok: false, retryable: true, error: error instanceof Error ? error.message : "brief unavailable" },
      { status: 502 },
    );
  }
}
