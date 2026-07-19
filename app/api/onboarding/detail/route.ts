import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
import { applyOnboardingDetail, onboardingDetailInputSchema } from "@/core/onboarding";

/*
 * POST /api/onboarding/detail (SAR-012 Pass 3, Phase E + F) — a per-section typed patch that
 * runs AFTER the D-accept (the profile is `complete`, the DETAIL gaps already exist). Body is
 * the discriminated `onboardingDetailInputSchema` (food · screen · focus · career · money ·
 * theme). The service re-validates server-side (integers/paise re-enforced; a float dies at
 * the boundary), patches the owning profile column(s), seeds E5 `recurring_rules`, and marks
 * that section's gap `answered` — it NEVER creates a gap. Skipping a section simply never
 * posts here, so its gap stays `open` for the SAR-014 daily-brief backfill. Idempotent replay.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = onboardingDetailInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid onboarding detail payload" }, { status: 400 });
    }

    const { repos } = await getSession();
    const result = await applyOnboardingDetail(parsed.data, repos);

    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, error: "onboarding detail failed" }, { status: 500 });
  }
}
