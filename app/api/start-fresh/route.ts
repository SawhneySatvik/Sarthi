import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SANDBOX_USER_COOKIE, sandboxCookieOptions } from "@/providers/auth/sandbox-cookie";

// A cookie-setting redirect must never be cached or statically evaluated.
export const dynamic = "force-dynamic";

/*
 * GET /api/start-fresh — the landing's "Start fresh" destination.
 *
 * Always REPLACES the sandbox cookie with a brand-new random userId, then lands on
 * onboarding. Replacing (not just navigating to `/onboarding`) is load-bearing: a visitor
 * who first tapped "Try the demo" carries the `local-dev` cookie, and a bare `/onboarding`
 * link would see the demo's completed profile and bounce straight back to /today. Minting a
 * fresh id guarantees a clean, empty sandbox → no profile → the onboarding walk.
 *
 * Reached via a PLAIN full-navigation `<a>` (not `next/link`) so it is never prefetched.
 */
export function GET(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/onboarding", request.url));
  response.cookies.set(SANDBOX_USER_COOKIE, crypto.randomUUID(), sandboxCookieOptions());
  return response;
}
