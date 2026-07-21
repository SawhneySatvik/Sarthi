import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeRelativeNext } from "./safe-next";

/*
 * GET /auth/callback — the Supabase reset (and email-confirm) redirect target. It establishes a
 * session from whatever the email template sends, then forwards to `next` (the set-new-password
 * screen). Two template shapes are supported so this works regardless of the project's config:
 *   - PKCE link  → `?code=...`               → exchangeCodeForSession(code)
 *   - default OTP → `?token_hash=...&type=..` → verifyOtp({ type, token_hash })
 * The session cookies are written by the server client's cookie writer (writable in a route
 * handler). Public + never cached (it mutates cookies). Meaningful only under AUTH_PROVIDER=
 * supabase; on any failure it bounces to /reset-password so the user simply requests a new link.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/reset-password/update";
  const failure = NextResponse.redirect(new URL("/reset-password?error=1", origin));

  if (code || tokenHash) {
    try {
      const { createSupabaseServerClient } = await import("@/providers/auth/supabase-server-client");
      const supabase = await createSupabaseServerClient();
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({
            type: (type ?? "recovery") as EmailOtpType,
            token_hash: tokenHash!,
          });
      if (error) {
        return failure;
      }
    } catch {
      return failure;
    }
  }

  // Only allow same-origin relative targets (redirect-target allowlist — SCREEN-AUTH §4).
  // `startsWith("/")` alone accepts `//evil.com` and `/\evil.com`, which resolve off-origin;
  // `safeRelativeNext` rejects both (open-redirect / phishing guard right after session set).
  return NextResponse.redirect(new URL(safeRelativeNext(next), origin));
}
