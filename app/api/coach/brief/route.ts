import { NextResponse } from "next/server";
import { z } from "zod";

import { coachForSession } from "@/app/lib/coach";
import { getSessionForRuntimeRequest } from "@/app/lib/session";
import { isRuntimeOverrideError } from "@/app/lib/runtimeOverride";
import { scrubProviderError, withByok } from "@/app/lib/byok";
import { isValidTimeZone, localDateInZone } from "@/core/time";

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
    session = withByok(await getSessionForRuntimeRequest(request), request);
  } catch (error) {
    if (isRuntimeOverrideError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    throw error;
  }
  const engine = coachForSession(session);
  try {
    let note;
    if (parsed.data.scope === "daily") {
      // D-053: the daily note's day-key is derived SERVER-SIDE from the profile timezone —
      // the client's `localDate` is accepted but NOT trusted for the day key, so the note the
      // brief writes is exactly the note Today's `eq(localDate)` filter later finds. (Weekly
      // `weekStart` stays the client's validated date — it is a chosen week boundary, not "now".)
      const profile = await session.repos.profile.profiles.byId(session.user.userId);
      const timezone = isValidTimeZone(profile?.timezone ?? "") ? profile!.timezone : "UTC";
      const localDate = localDateInZone(new Date().toISOString(), timezone);
      note = await engine.dailyBrief({ localDate, timezone });
    } else {
      note = await engine.weeklyBrief({ weekStart: parsed.data.localDate, timezone: parsed.data.timezone });
    }
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        retryable: true,
        error: scrubProviderError(error instanceof Error ? error.message : "brief unavailable", request.headers),
      },
      { status: 502 },
    );
  }
}
