import type { AuthProvider, AuthenticatedUser } from "@/core/contracts";
import type { AuthProviderName } from "@/app/lib/runtime";

import { AnonymousAuthProvider } from "./anonymous";
import { LocalPasswordAuthProvider } from "./local-password";
import { BearerAuthenticationError, parseBearerAccessToken, SupabaseAuthProvider } from "./supabase";

export { BearerAuthenticationError } from "./supabase";

/** Type guard for route handlers; never return the underlying provider message. */
export function isBearerAuthenticationError(error: unknown): error is BearerAuthenticationError {
  return error instanceof BearerAuthenticationError;
}

/**
 * Selects an auth adapter from a parsed server-side selector. Three branches are live:
 * local-password is the keyless dev/CI single-user gate (the de-risk deploy); anonymous is
 * the per-browser sandbox identity for the public deploy (no login); supabase is real
 * production email/password auth (SAR-021), enabled only by `AUTH_PROVIDER=supabase` — its
 * construction is side-effect-free and it refuses (never at import time) when creds are absent.
 */
export function createAuthProvider(name: AuthProviderName): AuthProvider {
  if (name === "supabase") {
    return new SupabaseAuthProvider();
  }
  if (name === "anonymous") {
    return new AnonymousAuthProvider();
  }
  return new LocalPasswordAuthProvider();
}

/**
 * Request-level auth composition for API consumers. With no Authorization header
 * this delegates exactly to the existing cookie/local auth provider. With a bearer
 * header it is intentionally Supabase-only: local and anonymous modes must never
 * reinterpret an arbitrary mobile token as their fixed/sandbox identity.
 */
export async function requireRequestUser(
  name: AuthProviderName,
  authorization: string | null,
): Promise<AuthenticatedUser> {
  if (authorization === null) {
    return createAuthProvider(name).requireUser();
  }
  if (name !== "supabase") {
    throw new BearerAuthenticationError();
  }
  return new SupabaseAuthProvider().requireUserFromAccessToken(parseBearerAccessToken(authorization));
}
