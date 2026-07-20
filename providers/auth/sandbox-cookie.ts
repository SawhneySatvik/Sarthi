/**
 * providers/auth/sandbox-cookie.ts — the single source of truth for the per-browser
 * anonymous sandbox identity cookie. Shared by three writers (the edge `middleware.ts`
 * minter, the `/api/try-demo` and `/api/start-fresh` route handlers) and one reader
 * (the `AnonymousAuthProvider`), so the name + options can never drift apart.
 *
 * This module is intentionally FRAMEWORK-CLEAN (no `next/*` import): the edge-runtime
 * middleware and the node-runtime route handlers both import the same constants without
 * dragging `next/headers` into an incompatible runtime. Each caller sets the cookie
 * through its own runtime's cookie API (`NextResponse.cookies` vs `next/headers`).
 */

/** httpOnly cookie holding the opaque per-browser userId (a UUID, or `local-dev` for the demo). */
export const SANDBOX_USER_COOKIE = "sarthi_sandbox_uid";

/** Roughly one year — the sandbox identity should persist across a stranger's return visits. */
const SANDBOX_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The write options, shaped to satisfy both `NextResponse.cookies.set(name, value, opts)`
 * and `next/headers` `cookieStore.set({ name, value, ...opts })`.
 *
 * `secure` is enabled only in production: localhost is served over http in dev, and a
 * `Secure` cookie would be dropped there, silently breaking the keyless local sandbox.
 * On Vercel (https) the cookie is always `Secure`.
 */
export function sandboxCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SANDBOX_COOKIE_MAX_AGE_SECONDS,
  };
}
