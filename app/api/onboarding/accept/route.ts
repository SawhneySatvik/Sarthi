import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
import { acceptOnboardingInputSchema, createAcceptOnboardingService } from "@/core/onboarding";

/*
 * POST /api/onboarding/accept (SAR-012 Pass 2, D-F) — the ONE atomic onboarding write.
 * Body: { answers, spines, timezone }. The server re-validates everything (integers
 * re-enforced; a float dies here) and runs the single `repos.transaction`: profile +
 * money categories/budgets + habits(+rules) + skills(+milestones) + per-domain plan
 * arcs/items + zeroed progress/snapshots + profile_gaps + the Day-1 coach note, flipping
 * onboardingStatus → 'complete' as the commit signal. Idempotent: a second accept (a
 * complete profile already exists) short-circuits to a replay no-op — never double-writes.
 * Nothing is created before this tap (invariant #1). The client clears its local draft
 * and advances to Today (Phase E→G polish is Pass 3).
 *
 * The schema validates the spines array (≥1, unique domains, selected-subset) and the IANA
 * timezone at the boundary, so those fail as a clean 400. Any other unexpected failure is
 * caught and returned as a typed `{ ok: false, error }` 500 (matching the app's route error
 * shape) rather than an unhandled framework 500 (CF-5).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = acceptOnboardingInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid onboarding accept payload" }, { status: 400 });
    }

    const { repos } = await getSession();
    const service = createAcceptOnboardingService({ repos });
    const result = await service.accept(parsed.data);

    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, error: "onboarding accept failed" }, { status: 500 });
  }
}
