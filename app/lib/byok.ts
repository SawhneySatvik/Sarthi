import "server-only";

import { createLlmGateway, createVisionProvider } from "@/providers";

import type { Session } from "./session";

/*
 * app/lib/byok.ts — Bring Your Own Key (BYOK).
 *
 * Strangers on the live deploy (where LLM_PROVIDER=fake) can run REAL AI captures with
 * their own Gemini/OpenAI key. The key lives ONLY in the browser's localStorage and the
 * in-flight request headers below; it is never written to the DB, never logged, and never
 * echoed in an error (see `scrubProviderError`). This is deliberately a SEPARATE seam from
 * the developer `x-sarthi-llm-provider` override (runtimeOverride.ts): that control is gated
 * to non-production/judge, whereas BYOK is a first-class user feature that must work in
 * public production.
 *
 * The override is applied provider-blind: it swaps the gateway/vision provider behind the
 * same `core/contracts` interfaces (invariant #3). It changes only WHICH model/key runs the
 * parse — never the trust seam. The commit route still re-routes every proposal server-side
 * (D-040), so "nothing estimated writes unconfirmed" is untouched by BYOK.
 */

/** Provider choice — a valid selectable BYOK key must name one of these. */
export type ByokProvider = "google" | "openai";

/** Sent per-request as headers. Values are transient and never persisted. */
export const BYOK_PROVIDER_HEADER = "x-sarthi-byok-provider";
export const BYOK_KEY_HEADER = "x-sarthi-byok-key";

export interface ByokCredential {
  provider: ByokProvider;
  apiKey: string;
}

function isByokProvider(value: string | null): value is ByokProvider {
  return value === "google" || value === "openai";
}

/**
 * Reads a BYOK credential from request headers, or null when absent/invalid. A missing
 * key OR an unknown provider is a clean null — the caller then falls back to the configured
 * (fake) stack. The key is trimmed but otherwise treated opaquely; validity is proven only
 * by a real provider call, never by us storing or inspecting it.
 */
export function readByokCredential(headers: Headers): ByokCredential | null {
  const provider = headers.get(BYOK_PROVIDER_HEADER);
  if (!isByokProvider(provider)) return null;
  const apiKey = headers.get(BYOK_KEY_HEADER)?.trim();
  if (!apiKey) return null;
  return { provider, apiKey };
}

/**
 * Returns a Session whose LLM + vision providers are the user's BYOK provider/key when a
 * valid credential is present, else the passed session unchanged. Repos/user/voice/media
 * are preserved — BYOK only swaps the AI seam. Never React-cached: a key resolved for one
 * request can never bleed into another.
 */
export function withByok(session: Session, request: Request): Session {
  const credential = readByokCredential(request.headers);
  if (!credential) return session;
  return {
    ...session,
    llm: createLlmGateway(credential.provider, { apiKey: credential.apiKey }),
    vision: createVisionProvider(credential.provider, { apiKey: credential.apiKey }),
  };
}

/**
 * Removes any BYOK key substring from a provider error message before it reaches the client
 * or a log. Some providers (notably OpenAI) echo a masked key fragment such as
 * `Incorrect API key provided: sk-...` — this guarantees no portion of the user's key can
 * surface on an error surface. Pass the request's headers so the exact key is scrubbed.
 */
export function scrubProviderError(message: string, headers: Headers): string {
  const apiKey = headers.get(BYOK_KEY_HEADER)?.trim();
  if (!apiKey) return message;
  return message.split(apiKey).join("[redacted]");
}
