import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SANDBOX_USER_COOKIE, sandboxCookieOptions } from "@/providers/auth/sandbox-cookie";

/*
 * middleware.ts — mints the per-browser anonymous sandbox identity BEFORE any render.
 *
 * Next 16 forbids writing cookies during a Server Component render, so the page-render
 * entry points (`/today`, `/onboarding`, …) can never mint their own identity. This
 * middleware runs first on every page navigation: if `AUTH_PROVIDER=anonymous` and the
 * browser has no sandbox cookie yet, it mints one opaque UUID, sets it on BOTH the
 * forwarded request (so the current render's `AnonymousAuthProvider.requireUser()` reads
 * it) and the response (so the browser persists it). Every later request from that browser
 * reuses the same cookie → the same `userId` → the same isolated repository scope.
 *
 * Inert unless anonymous: on the keyless `local-password` de-risk deploy (and F3) this is a
 * pass-through no-op, so the demo spine is untouched. The `/api/try-demo` and
 * `/api/start-fresh` handlers own their own cookie and are excluded by the matcher below so
 * middleware never fights them.
 *
 * SAR-021: when `AUTH_PROVIDER=supabase` (production auth), the supabase branch is checked FIRST
 * and the helper is DYNAMIC-imported, so the default edge bundle never loads a line of Supabase
 * code — the local-password / anonymous paths stay byte-for-byte unchanged (guardrail #1).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (process.env.AUTH_PROVIDER === "supabase") {
    const { updateSupabaseSession } = await import("@/providers/auth/supabase-middleware");
    return updateSupabaseSession(request);
  }

  if (process.env.AUTH_PROVIDER !== "anonymous") {
    return NextResponse.next();
  }

  const existing = request.cookies.get(SANDBOX_USER_COOKIE)?.value;
  if (existing !== undefined && existing.length > 0) {
    return NextResponse.next();
  }

  const userId = crypto.randomUUID();
  // Set on the request so THIS render already sees the new identity, then forward those
  // headers; set on the response so the browser stores it for every later request.
  request.cookies.set(SANDBOX_USER_COOKIE, userId);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(SANDBOX_USER_COOKIE, userId, sandboxCookieOptions());
  return response;
}

export const config = {
  // Run on page navigations only. Exclude Next internals, static assets, and ALL API routes
  // (the sandbox cookie is minted on the preceding page load; `/api/try-demo` and
  // `/api/start-fresh` set their own cookie and must not be pre-minted here).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
