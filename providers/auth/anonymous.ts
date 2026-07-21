import type { AuthProvider, AuthenticatedUser } from "@/core/contracts";
import { ProviderConfigurationError } from "@/core/contracts";

import { SANDBOX_USER_COOKIE, sandboxCookieOptions } from "./sandbox-cookie";

/**
 * Per-browser anonymous sandbox auth (login-less). Selected via `AUTH_PROVIDER=anonymous`
 * on the public deploy: every browser gets its OWN opaque userId held in an httpOnly
 * cookie, which flows through the existing repository `userId` scoping to give each visitor
 * an isolated workspace — no password, no account store.
 *
 * The cookie is normally minted by `middleware.ts` BEFORE any render or route handler runs
 * (Next 16 forbids writing cookies during a Server Component render). `requireUser` here is
 * therefore a READER: it returns the cookie's userId. The mint-and-set fallback below only
 * fires in the rare case a route handler is the very first request with no cookie yet — a
 * context where writing a cookie IS permitted; if writing is not permitted (a render that
 * somehow slipped past middleware) the set is swallowed and a fresh id is still returned so
 * the request never crashes.
 *
 * `next/headers` is imported lazily so this module stays framework-clean in the module graph
 * (the `providers/auth` barrel is imported by non-Next tsx test suites); the import only
 * resolves at call time, always inside a real request.
 */
export class AnonymousAuthProvider implements AuthProvider {
  async requireUser(): Promise<AuthenticatedUser> {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    const existing = cookieStore.get(SANDBOX_USER_COOKIE)?.value;
    if (existing !== undefined && existing.length > 0) {
      return this.identify(existing);
    }

    // No cookie yet (route-handler-first request, or middleware disabled). Mint one and
    // best-effort persist it; a render context throws on set, which we ignore.
    const userId = crypto.randomUUID();
    try {
      cookieStore.set(SANDBOX_USER_COOKIE, userId, sandboxCookieOptions());
    } catch {
      // Setting cookies is only allowed in a Route Handler / Server Action; during a
      // render this throws. Middleware is responsible for persistence in that path, so we
      // fall through and still return the freshly-minted identity for this request.
    }
    return this.identify(userId);
  }

  /**
   * A sandbox user has no account, so it presents as `mode: "local"` (keyless, no sign-in
   * affordance — the same posture as the local-password gate). This keeps onboarding from
   * rendering a production sign-in link for a login-less visitor.
   */
  private identify(userId: string): AuthenticatedUser {
    return { userId, email: null, mode: "local" };
  }

  // No account lifecycle in sandbox mode. `signIn`/`signUp` REFUSE (defense-in-depth): a
  // resolving no-op would let the real-auth UI (which only exists under supabase) fabricate a
  // "success" if it were ever reached on the anonymous deploy — no account is created, so it
  // must never pretend one was. `signOut` and the reset methods stay best-effort no-ops (there
  // is no session or account store to tear down; a stray call must not break the sandbox).
  async signUp(): Promise<void> {
    throw new ProviderConfigurationError(
      "signUp is not supported in anonymous sandbox mode (use Supabase in production).",
    );
  }
  async signIn(): Promise<void> {
    throw new ProviderConfigurationError(
      "signIn is not supported in anonymous sandbox mode (use Supabase in production).",
    );
  }
  async signOut(): Promise<void> {}
  async requestPasswordReset(): Promise<void> {}
  async updatePassword(): Promise<void> {}
}
