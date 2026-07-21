import type { AuthProvider, AuthenticatedUser } from "@/core/contracts";
import { RepositoryError } from "@/core/contracts";

/**
 * A request presented a bearer credential that cannot establish a Supabase
 * identity. Kept separate from configuration failures so route handlers can
 * return a safe 401 without turning a bad mobile token into a web redirect.
 */
export class BearerAuthenticationError extends Error {
  constructor() {
    super("Unauthorized bearer token.");
    this.name = "BearerAuthenticationError";
  }
}

/**
 * Strict RFC 6750-style parsing. A malformed Authorization header must never
 * silently fall back to a browser cookie, otherwise a native client could be
 * bound to the wrong identity on a shared device.
 */
export function parseBearerAccessToken(authorization: string | null): string {
  if (authorization === null) {
    throw new BearerAuthenticationError();
  }

  const match = /^Bearer[\t ]+([A-Za-z0-9\-._~+/]+={0,})$/i.exec(authorization);
  if (!match) {
    throw new BearerAuthenticationError();
  }
  return match[1];
}

/**
 * Production auth over Supabase Auth (email/password + reset). Enabled by `AUTH_PROVIDER=supabase`.
 *
 * Construction is side-effect-free: NO import of `@supabase/*`, `next/headers`, or
 * `next/navigation` at module load, so the `providers/auth` barrel stays importable by the
 * node/tsx test suites AND the default (local-password / anonymous) stack never loads a line of
 * Supabase code. Each method lazily imports the server client; when the public Supabase env is
 * absent it refuses with `ProviderConfigurationError` (via `requireSupabaseEnv`) — never at
 * import time (guardrail #1).
 *
 * Tenant isolation (guardrail #3): `requireUser` resolves the STABLE Supabase user id, which the
 * session composition (`app/lib/session.ts`) threads through the identical scoped repository
 * factory. The client never sees or supplies a `userId`.
 */
export class SupabaseAuthProvider implements AuthProvider {
  async requireUser(): Promise<AuthenticatedUser> {
    const { createSupabaseServerClient } = await import("./supabase-server-client");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      return { userId: data.user.id, email: data.user.email ?? null, mode: "supabase" };
    }
    // Unauthenticated on a protected route → bounce to the login screen. `redirect` throws
    // (returns `never`), so this is the function's terminal path. Middleware normally protects
    // pages before this runs; this is the defense-in-depth fallback for a route handler read.
    const { redirect } = await import("next/navigation");
    redirect("/login");
    // `redirect` throws `NEXT_REDIRECT` to interrupt the request, so this never executes; it
    // only gives the compiler a terminal path (the dynamic import widens redirect's `never`).
    throw new RepositoryError("redirect to /login did not interrupt the request");
  }

  /**
   * Native clients keep their Supabase session in secure storage, not a cookie.
   * Validate the supplied access token with Supabase Auth before using its
   * server-owned subject for repository scoping. Do not decode JWT claims here.
   */
  async requireUserFromAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const { createSupabaseAccessTokenClient } = await import("./supabase-server-client");
    const supabase = createSupabaseAccessTokenClient();
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new BearerAuthenticationError();
    }
    return { userId: data.user.id, email: data.user.email ?? null, mode: "supabase" };
  }

  async signUp(input: { email: string; password: string }): Promise<void> {
    const { createSupabaseServerClient } = await import("./supabase-server-client");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({ email: input.email, password: input.password });
    if (error) {
      throw new RepositoryError(error.message);
    }
  }

  async signIn(input: { email: string; password: string }): Promise<void> {
    const { createSupabaseServerClient } = await import("./supabase-server-client");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) {
      // Generic message — never reveal whether the email exists (enumeration-safe).
      throw new RepositoryError("Invalid email or password.");
    }
  }

  async signOut(): Promise<void> {
    const { createSupabaseServerClient } = await import("./supabase-server-client");
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  async requestPasswordReset(input: { email: string; redirectTo: string }): Promise<void> {
    // Enumeration-safe: ALWAYS resolves. Never signals whether the address is registered, whether
    // the provider is configured, or whether the transport succeeded — the caller shows one quiet
    // "if eligible, a link was sent" confirmation regardless.
    try {
      const { createSupabaseServerClient } = await import("./supabase-server-client");
      const supabase = await createSupabaseServerClient();
      await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: input.redirectTo });
    } catch {
      // Swallow every error (missing env, unknown address, transport failure).
    }
  }

  async updatePassword(input: { password: string }): Promise<void> {
    const { createSupabaseServerClient } = await import("./supabase-server-client");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) {
      throw new RepositoryError(error.message);
    }
  }
}
