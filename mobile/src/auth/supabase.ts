import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { SQLiteStorage } from "expo-sqlite/kv-store";
import aesjs from "aes-js";
import { AppState, type AppStateStatus } from "react-native";
import { createClient, processLock, type Session, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthGateway, NativeSession, SecureSessionStore } from "./session";

const authStorage = new SQLiteStorage("sarthi-native-auth.db");
const keyPrefix = "sarthi.auth.aes.";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Supabase's large-session pattern adapted to Expo SQLite: ciphertext lives in
 * local SQLite; a 256-bit AES key lives in the device keychain via SecureStore.
 * A fresh IV is stored beside each ciphertext, preventing CTR keystream reuse.
 */
export class EncryptedSqliteSessionStorage {
  async getItem(key: string): Promise<string | null> {
    const payload = await authStorage.getItem(key);
    if (!payload) return null;
    const separator = payload.indexOf(":");
    if (separator < 1) return null;
    const securedKey = await SecureStore.getItemAsync(`${keyPrefix}${key}`);
    if (!securedKey) return null;
    try {
      const iv = aesjs.utils.hex.toBytes(payload.slice(0, separator));
      const cipherText = aesjs.utils.hex.toBytes(payload.slice(separator + 1));
      const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(securedKey), new aesjs.Counter(iv));
      return aesjs.utils.utf8.fromBytes(cipher.decrypt(cipherText));
    } catch {
      await this.removeItem(key);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = randomBytes(32);
    const iv = randomBytes(16);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(iv));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(`${keyPrefix}${key}`, aesjs.utils.hex.fromBytes(encryptionKey), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await authStorage.setItem(key, `${aesjs.utils.hex.fromBytes(iv)}:${aesjs.utils.hex.fromBytes(encrypted)}`);
  }

  async removeItem(key: string): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(`${keyPrefix}${key}`),
      authStorage.removeItem(key),
    ]);
  }
}

function sessionFromSupabase(session: Session, onboardingComplete = true): NativeSession {
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAtMs: session.expires_at ? session.expires_at * 1000 : undefined,
    onboardingComplete,
  };
}

async function requiredSession(client: SupabaseClient): Promise<Session> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("A confirmed Supabase session is required");
  return data.session;
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async signUp(input: { email: string; password: string }): Promise<NativeSession> {
    const { data, error } = await this.client.auth.signUp(input);
    if (error) throw error;
    if (!data.session) throw new Error("Check your email, then sign in to continue.");
    return sessionFromSupabase(data.session, false);
  }

  async signIn(input: { email: string; password: string }): Promise<NativeSession> {
    const { data, error } = await this.client.auth.signInWithPassword(input);
    if (error || !data.session) throw error ?? new Error("Sign-in did not return a session");
    return sessionFromSupabase(data.session);
  }

  async requestPasswordReset(input: { email: string; redirectTo: string }): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(input.email, { redirectTo: input.redirectTo });
    if (error) throw error;
  }

  async updatePassword(input: { password: string }): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password: input.password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }
}

export function createSupabaseMobileClient(config: { url: string; publishableKey: string }): SupabaseClient {
  if (!config.url || !config.publishableKey) throw new Error("Missing Expo public Supabase configuration");
  return createClient(config.url, config.publishableKey, {
    auth: {
      storage: new EncryptedSqliteSessionStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
}

/** Start refresh only while foregrounded; returns the AppState cleanup. */
export function installSupabaseAppStateRefresh(client: SupabaseClient): () => void {
  const update = (state: AppStateStatus) => {
    if (state === "active") client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  };
  update(AppState.currentState);
  const subscription = AppState.addEventListener("change", update);
  return () => subscription.remove();
}

/** Handles `sarthi://auth/callback?code=…` plus implicit grant fallback links. */
export async function handleSupabaseAuthCallback(client: SupabaseClient, url: string): Promise<NativeSession | null> {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1).split("#")[0] : "";
  const fragment = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const params = new URLSearchParams(query || fragment);
  const code = params.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return null;
    const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  }
  return sessionFromSupabase(await requiredSession(client));
}

/** Lets the existing UI controller persist the opaque native session shape. */
export class NativeSecureSessionStore implements SecureSessionStore {
  private readonly key = "native-session";
  private readonly storage = new EncryptedSqliteSessionStorage();

  async get(): Promise<NativeSession | null> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as NativeSession;
      return typeof parsed.userId === "string" && typeof parsed.accessToken === "string" ? parsed : null;
    } catch {
      return null;
    }
  }

  async set(session: NativeSession): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(session));
  }

  async clear(): Promise<void> {
    await this.storage.removeItem(this.key);
  }
}
