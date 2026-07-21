import type { AuthProvider } from "@/core/contracts";
import type { AuthProviderName } from "@/app/lib/runtime";

import { AnonymousAuthProvider } from "./anonymous";
import { LocalPasswordAuthProvider } from "./local-password";
import { SupabaseAuthProvider } from "./supabase";

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
