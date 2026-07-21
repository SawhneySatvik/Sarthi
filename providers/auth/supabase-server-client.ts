import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ProviderConfigurationError } from "@/core/contracts";

const MISSING_ENV =
  "AUTH_PROVIDER=supabase but NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.";

/**
 * Reads the public Supabase credentials. Throws a typed `ProviderConfigurationError`
 * ONLY when actually invoked with the creds absent — construction of the adapter never
 * touches this, so selecting the default (local-password / anonymous) stack keeps booting
 * with no Supabase creds present (guardrail #1).
 */
export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new ProviderConfigurationError(MISSING_ENV);
  }
  return { url, anonKey };
}

/**
 * A Supabase server client bound to the request cookie jar via `next/headers`.
 *
 * `next/headers` is imported LAZILY so this module never drags a Next-only import into the
 * node/tsx test graph that imports the `providers/auth` barrel (the same reason the anonymous
 * adapter lazy-imports it). `@supabase/ssr` itself is node-safe as a static import.
 *
 * Cookie writes are wrapped in try/catch: during a Server Component render the cookie store is
 * read-only (setAll throws) and the edge middleware owns the token refresh, so swallowing is
 * correct there; inside a Server Action / Route Handler the writes succeed normally.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = requireSupabaseEnv();
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Render context: cookies are read-only here; middleware refreshes the session.
        }
      },
    },
  });
}
