import { NextResponse } from "next/server";
import { z } from "zod";

import { coachForSession } from "@/app/lib/coach";
import { getSession } from "@/app/lib/session";
import { scrubProviderError, withByok } from "@/app/lib/byok";

const lookupSchema = z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose-reentry"), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.enum(["keep", "revert"]), adaptationId: z.string().min(1) }),
]);

/** Pure lookup: cacheable GETs never create an adaptation or alter a plan. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = lookupSchema.safeParse({ localDate: url.searchParams.get("localDate") });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid re-entry lookup" }, { status: 400 });
  const engine = coachForSession(await getSession());
  const [adaptation, game] = await Promise.all([engine.findReentryAdaptation(parsed.data), engine.gameSummary(parsed.data)]);
  return NextResponse.json({ ok: true, adaptation, game });
}

/** Explicit actions can propose re-entry, Keep, or Revert; clients never send snapshots. */
export async function POST(request: Request): Promise<Response> {
  const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid adaptation resolution" }, { status: 400 });
  try {
    const engine = coachForSession(withByok(await getSession(), request));
    const adaptation = parsed.data.action === "propose-reentry"
      ? await engine.ensureReentryAdaptation({ localDate: parsed.data.localDate })
      : await engine.resolveAdaptation(parsed.data);
    return NextResponse.json({ ok: true, adaptation });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: scrubProviderError(error instanceof Error ? error.message : "adaptation unavailable", request.headers) },
      { status: 409 },
    );
  }
}
