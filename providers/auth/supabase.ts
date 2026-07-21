import type { AuthProvider, AuthenticatedUser } from "@/core/contracts";
import { RepositoryError } from "@/core/contracts";

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
