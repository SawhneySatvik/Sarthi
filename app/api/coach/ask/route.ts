import { NextResponse } from "next/server";
import { z } from "zod";

import { coachForSession } from "@/app/lib/coach";
import { getSessionForRuntimeRequest } from "@/app/lib/session";
import { isRuntimeOverrideError } from "@/app/lib/runtimeOverride";
import { scrubProviderError, withByok } from "@/app/lib/byok";
import { projectCoachMessage, projectCoachThread } from "@/core/coach";
import { isValidTimeZone, localDateInZone } from "@/core/time";

const requestSchema = z.object({ text: z.string().trim().min(1).max(2000), timezone: z.string().min(1).max(100) });

/**
 * COACH-2 — the grounded, persistent coach turn. The request is unchanged
 * (`{text, timezone}`) for client stability; `localDate` is derived SERVER-SIDE from the
 * profile timezone (D-053), never trusted from the client. The turn persists both the
 * user and the coach `coach_messages` rows; the response returns the coach message plus a
 * validated adaptation intent (row creation is COACH-3) and the last-30 page-safe thread.
 */
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
    const profile = await session.repos.profile.profiles.byId(session.user.userId);
    const timezone = isValidTimeZone(profile?.timezone ?? "") ? profile!.timezone : "UTC";
    const localDate = localDateInZone(new Date().toISOString(), timezone);
    const { message, proposedAdaptation } = await coachForSession(session).converse({
      text: parsed.data.text,
      timezone: parsed.data.timezone,
      localDate,
    });
    const thread = projectCoachThread(await session.repos.coach.messages.list({}));
    return NextResponse.json({
      ok: true,
      message: projectCoachMessage(message),
      proposedAdaptation: proposedAdaptation ?? null,
      thread,
    });
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
