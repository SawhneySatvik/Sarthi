import type { AuthProvider } from "@/core/contracts";
import type { AuthProviderName } from "@/app/lib/runtime";

import { LocalPasswordAuthProvider } from "./local-password";
import { SupabaseAuthProvider } from "./supabase";

/**
 * Selects an auth adapter from a parsed server-side selector. Both branches are
 * live: local-password is the keyless dev/CI gate; supabase is the composition-ready
 * production stub whose methods refuse until SAR-021.
 */
export function createAuthProvider(name: AuthProviderName): AuthProvider {
  if (name === "supabase") {
    return new SupabaseAuthProvider();
  }
  return new LocalPasswordAuthProvider();
}
