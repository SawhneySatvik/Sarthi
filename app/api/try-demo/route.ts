import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SANDBOX_USER_COOKIE, sandboxCookieOptions } from "@/providers/auth/sandbox-cookie";

// A cookie-setting redirect must never be cached or statically evaluated.
export const dynamic = "force-dynamic";

/*
 * GET /api/try-demo — the landing's "Try the demo" destination.
 *
 * Points the browser's sandbox identity at the seeded demo user (`local-dev`, the id the
 * demo data is seeded under by scripts/seed-postgres.ts + scripts/seed-dev.ts) and lands on
 * Today. Reached via a PLAIN full-navigation `<a>` (not `next/link`) so it is never
 * prefetched — a prefetch would flip the cookie + redirect on hover.
 *
 * CAVEAT (v1, accepted): this is a SHARED, read-mostly demo. Every visitor who taps it maps
 * to the same `local-dev` scope, so a demo capture would write into the shared demo data. A
 * per-visitor seed clone (isolated demo per browser) is out of scope tonight. Never
 * paywalled (invariant #10): the demo is always free.
 */
export function GET(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/today", request.url));
  response.cookies.set(SANDBOX_USER_COOKIE, "local-dev", sandboxCookieOptions());
  return response;
}
