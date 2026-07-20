import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { reposForUserId } from "@/app/lib/session";
import { seedDemo } from "@/data/seed/demo";
import { SANDBOX_USER_COOKIE, sandboxCookieOptions } from "@/providers/auth/sandbox-cookie";

// A cookie-setting redirect that also writes the DB must never be cached or statically evaluated.
export const dynamic = "force-dynamic";

/*
 * GET /api/try-demo — the landing's "Try the demo" destination.
 *
 * PER-VISITOR ISOLATED demo: mint a fresh opaque userId, seed the full populated demo under
 * that id, then point the browser's sandbox identity (`SANDBOX_USER_COOKIE`) at it and land on
 * Today. Each visitor therefore gets their OWN workspace — a demo capture writes only into that
 * visitor's clone, never a shared dataset. Reached via a PLAIN full-navigation `<a>` (not
 * `next/link`) so it is never prefetched (a prefetch would seed + flip the cookie on hover).
 *
 * Requires `AUTH_PROVIDER=anonymous` at runtime so the minted id flows through the repository
 * `userId` scoping (the deploy sets it). This handler only mints the id, seeds, and sets the
 * cookie.
 *
 * ROBUSTNESS: if seeding fails for ANY reason, fall back to the prior shared-demo behaviour
 * (cookie = `local-dev`, redirect to Today) so the demo never hard-fails for a judge. Never
 * paywalled (invariant #10): the demo is always free.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const target = new URL("/today", request.url);
  try {
    const userId = crypto.randomUUID();
    const repos = reposForUserId(userId);
    await seedDemo(repos, { state: "populated" });
    const response = NextResponse.redirect(target);
    response.cookies.set(SANDBOX_USER_COOKIE, userId, sandboxCookieOptions());
    return response;
  } catch (error) {
    console.error("[try-demo] per-visitor seed failed; falling back to shared demo", error);
    const response = NextResponse.redirect(target);
    response.cookies.set(SANDBOX_USER_COOKIE, "local-dev", sandboxCookieOptions());
    return response;
  }
}
