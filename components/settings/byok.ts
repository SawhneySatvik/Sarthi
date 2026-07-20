"use client";

/*
 * components/settings/byok.ts — the client half of Bring Your Own Key.
 *
 * The user's API key lives ONLY here: in localStorage (so it survives reloads) and in the
 * per-request headers `byokHeaders()` builds. It is never sent to our database and never
 * logged. `getByokCredential` returns a stable reference between writes so it is safe to
 * drive `useSyncExternalStore`. Server routes enforce everything; this is transport only.
 */

export type ByokProvider = "google" | "openai";

export interface ByokCredential {
  provider: ByokProvider;
  apiKey: string;
}

const STORAGE_KEY = "sarthi-byok";
export const BYOK_PROVIDER_HEADER = "x-sarthi-byok-provider";
export const BYOK_KEY_HEADER = "x-sarthi-byok-key";

let cache: ByokCredential | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(): ByokCredential | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { provider?: unknown; apiKey?: unknown };
    const provider = parsed.provider;
    const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
    if ((provider === "google" || provider === "openai") && apiKey) {
      return { provider, apiKey };
    }
  } catch {
    // Storage disabled / malformed — treat as no key. The seeded demo still runs.
  }
  return null;
}

function ensureLoaded(): void {
  if (!loaded) {
    cache = readStorage();
    loaded = true;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getByokCredential(): ByokCredential | null {
  ensureLoaded();
  return cache;
}

export function hasByokKey(): boolean {
  return getByokCredential() !== null;
}

export function setByokCredential(credential: ByokCredential): void {
  const apiKey = credential.apiKey.trim();
  cache = { provider: credential.provider, apiKey };
  loaded = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Persistence unavailable — the key still works for this session in memory.
  }
  emit();
}

export function clearByokCredential(): void {
  cache = null;
  loaded = true;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to remove / storage disabled.
  }
  emit();
}

export function subscribeByok(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** SSR snapshot: the server never has the browser-only key. */
export function getByokServerSnapshot(): ByokCredential | null {
  return null;
}

/**
 * The two transient headers a real-AI request carries. Empty when no key is saved, so the
 * request falls back to the server's configured (fake, keyless) stack — the seeded demo
 * never needs a key.
 */
export function byokHeaders(): HeadersInit {
  const credential = getByokCredential();
  return credential
    ? { [BYOK_PROVIDER_HEADER]: credential.provider, [BYOK_KEY_HEADER]: credential.apiKey }
    : {};
}
