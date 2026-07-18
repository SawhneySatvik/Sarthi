import { NextResponse } from "next/server";
import { z } from "zod";

import { coachForSession } from "@/app/lib/coach";
import { getSession } from "@/app/lib/session";

const requestSchema = z.object({ text: z.string().trim().min(1).max(2000), timezone: z.string().min(1).max(100) });

/** Session-only v1 ask: no message rows or arbitrary action payloads persist. */
export async function POST(request: Request): Promise<Response> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid coach question" }, { status: 400 });
  const answer = await coachForSession(await getSession()).ask(parsed.data);
  return NextResponse.json({ ok: true, answer });
}
