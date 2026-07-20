import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
import { seedDemo } from "@/data/seed/demo";

/*
 * POST /api/dev/seed-demo (SAR-012 Pass 3, D-G) — the keyless judge/dev recording gesture.
 * Runs the SAME shared, `seed_runs`-idempotent `seedDemo` as `scripts/seed-dev.ts`, cloning
 * the populated 12-day demo into the current single user and landing them on Today.
 *
 * GUARDED to the keyless local dev stack: any non-`local` auth mode gets a 404 (not 403) — the
 * gesture must be invisible in a real deployment. Because the anonymous public provider is ALSO
 * `mode:"local"`, a production deploy would otherwise leave this POST reachable; it is therefore
 * additionally gated OFF whenever `NODE_ENV === "production"`. The production judge/demo path is
 * the pre-seeded `local-dev` user reached via `/api/try-demo`, not this route. The
 * authenticated-signup-gated clone is SAR-021+ (multi-tenant, HARD STOP). Never paywalled
 * (invariant #10): the demo is free.
 */
export async function POST(): Promise<Response> {
  try {
    const { user, repos } = await getSession();
    if (user.mode !== "local" || process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }

    const result = await seedDemo(repos);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, error: "seed failed" }, { status: 500 });
  }
}
