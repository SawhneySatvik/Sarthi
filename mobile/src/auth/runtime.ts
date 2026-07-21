import type { AuthenticatedUser } from "@contracts";
import { LOCAL_DEV_USER } from "@mobile/adapters/local-auth";

import { NativeAuthController, type AuthSnapshot } from "./session";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  NativeSecureSessionStore,
  SupabaseAuthGateway,
  createSupabaseMobileClient,
  installSupabaseAppStateRefresh,
} from "./supabase";

export type NativeAuthRuntime =
  | { kind: "local"; user: AuthenticatedUser }
  | { kind: "supabase"; client: SupabaseClient; controller: NativeAuthController; stopRefresh: () => void };

export function createNativeAuthRuntime(config: { url?: string; publishableKey?: string }): NativeAuthRuntime {
  if (!config.url || !config.publishableKey) return { kind: "local", user: LOCAL_DEV_USER };
  const client = createSupabaseMobileClient({ url: config.url, publishableKey: config.publishableKey });
  return {
    kind: "supabase",
    client,
    controller: new NativeAuthController(new SupabaseAuthGateway(client), new NativeSecureSessionStore()),
    stopRefresh: installSupabaseAppStateRefresh(client),
  };
}

export function userFromAuthSnapshot(snapshot: AuthSnapshot): AuthenticatedUser | null {
  if (snapshot.status !== "signed-in") return null;
  return { userId: snapshot.session.userId, email: null, mode: "supabase" };
}
