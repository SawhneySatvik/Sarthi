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

/** Lazy process singleton from env (the cap and cache are per process). */
export function decisionProviderFromEnv(log?: (line: string) => void): DecisionProvider {
  if (singleton) return singleton;
  const name: DecisionProviderName = process.env.DECISIONS_PROVIDER === "openai" ? "openai" : "fake";
  const cap = Number.parseInt(process.env.DECISIONS_MAX_CALLS ?? "", 10);
  singleton = createDecisionProvider(name, {
    apiKey: process.env.OPENAI_API_KEY?.trim() || null,
    maxCalls: Number.isSafeInteger(cap) && cap >= 0 ? cap : 25,
    log,
  });
  return singleton;
}
