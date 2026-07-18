import { NextResponse } from "next/server";
import { z } from "zod";

import { coachForSession } from "@/app/lib/coach";
import { getSession } from "@/app/lib/session";

const requestSchema = z.object({
  scope: z.enum(["daily", "weekly"]),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(100),
});

/** Generates/reuses a staleness-keyed, tenant-scoped Coach note. */
export async function POST(request: Request): Promise<Response> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid brief request" }, { status: 400 });
  const engine = coachForSession(await getSession());
  const note = parsed.data.scope === "daily"
    ? await engine.dailyBrief({ localDate: parsed.data.localDate, timezone: parsed.data.timezone })
    : await engine.weeklyBrief({ weekStart: parsed.data.localDate, timezone: parsed.data.timezone });
  return NextResponse.json({ ok: true, note });
}
