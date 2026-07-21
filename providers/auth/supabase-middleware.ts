import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

/**
 * Page paths reachable WITHOUT a Supabase session. Everything else under the middleware page
 * matcher is a protected app route → unauthenticated visitors are redirected to `/login`. The
 * matcher already excludes `/api/*` route handlers, so this is a page-path allowlist only.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/privacy",
  "/terms",
  "/waitlist",
  "/offline",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Supabase session refresh + route protection for `AUTH_PROVIDER=supabase` (the canonical
 * Supabase SSR middleware pattern). Revalidate via `getUser()`, and write refreshed cookies on
 * BOTH the forwarded request (so this render's `requireUser` sees the fresh session) and the
 * response (so the browser persists it). A logged-in user moving between two protected pages must
 * NEVER bounce to `/login` — that is the cookie-forwarding invariant; when we redirect an
 * unauthenticated user we carry the refreshed cookies onto the redirect too.
 *
 * If the public creds are absent (a half-configured supabase mode) this degrades to a passthrough
 * so public pages still boot rather than 500 — the adapter still refuses on real use.
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: revalidate with getUser() (never trust getSession() in middleware).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    // Carry the refreshed cookies onto the redirect so the session refresh is never dropped.
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}
