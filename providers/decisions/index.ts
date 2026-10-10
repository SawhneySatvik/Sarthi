/**
 * DecisionProvider selection: `DECISIONS_PROVIDER=openai|fake` (default fake).
 * The openai adapter reads only OPENAI_API_KEY; cap via DECISIONS_MAX_CALLS (default 25).
 */
import type { DecisionProvider, DecisionProviderName } from "@/core/contracts";

import { createFakeDecisionProvider } from "./fake";
import { createOpenAiDecisionProvider, type OpenAiDecisionOptions } from "./openai";

export { createFakeDecisionProvider, fakeAnswers } from "./fake";
export { createOpenAiDecisionProvider, DECISIONS_MODEL, type DecisionStats, type OpenAiDecisionOptions } from "./openai";

export function createDecisionProvider(
  name: DecisionProviderName,
  options: OpenAiDecisionOptions = {},
): DecisionProvider {
  if (name === "openai") return createOpenAiDecisionProvider(options);
  return createFakeDecisionProvider();
}

let singleton: DecisionProvider | null = null;

export const DEFAULT_DECISIONS_TIMEOUT_MS = 2500;
/** `DECISIONS_TIMEOUT_MS` → integer ms, default 2500, clamped to 500–15000. */
export function decisionsTimeoutMs(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isSafeInteger(n)) return DEFAULT_DECISIONS_TIMEOUT_MS;
  return Math.min(15000, Math.max(500, n));
}

/** Lazy process singleton from env (the cap and cache are per process). */
export function decisionProviderFromEnv(log?: (line: string) => void): DecisionProvider {
  if (singleton) return singleton;
  const name: DecisionProviderName = process.env.DECISIONS_PROVIDER === "openai" ? "openai" : "fake";
  const cap = Number.parseInt(process.env.DECISIONS_MAX_CALLS ?? "", 10);
  singleton = createDecisionProvider(name, {
    apiKey: process.env.OPENAI_API_KEY?.trim() || null,
    maxCalls: Number.isSafeInteger(cap) && cap >= 0 ? cap : 25,
    timeoutMs: decisionsTimeoutMs(process.env.DECISIONS_TIMEOUT_MS),
    log,
  });
  return singleton;
}
