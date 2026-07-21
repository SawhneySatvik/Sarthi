import type { LlmGateway, UserScopedRepositories } from "@/core/contracts";
import type { ReflectionMood } from "@/data/schema/contract";

import { DOMAIN_REGISTRY } from "./registry";

export interface ReflectionSummaryInput {
  localDate: string;
  mood: ReflectionMood;
  energyLevel: number;
  sleepMinutes: number | null;
  journal: string;
}

export interface ReflectionSummary {
  text: string;
  provider: string;
  modelId: string;
  usedFallback: boolean;
}

function factualFallback(input: ReflectionSummaryInput): string {
  const sleep = input.sleepMinutes === null ? "Sleep was not recorded." : `Sleep: ${input.sleepMinutes} minutes.`;
  const note = input.journal ? `You wrote: ${input.journal.slice(0, 180)}` : "You saved a quiet check-in.";
  return `${input.mood} mood, energy ${input.energyLevel}/5. ${sleep} ${note}`;
}

/**
 * Read-only reflection seam: it supplies the provider only user-authored fields
 * and typed same-day domain facts. A provider failure keeps the reflection with
 * an explicitly deterministic factual fallback; it never pretends AI succeeded.
 */
export async function summarizeReflection(
  repos: UserScopedRepositories,
  llm: LlmGateway,
  input: ReflectionSummaryInput,
): Promise<ReflectionSummary> {
  const contexts = await Promise.all(
    DOMAIN_REGISTRY.map((spec) => spec.contextLoader(repos, { start: input.localDate, end: input.localDate })),
  );
  const facts = contexts.flatMap((context) => context.evidence).map((fact) => ({
    domain: fact.domain, entryKind: fact.entryKind, label: fact.label, valueInt: fact.valueInt, unit: fact.unit,
  }));
  try {
    const result = await llm.generateText({
      tier: "fast",
      system:
        "You are Sarthi. Write ONE concise, gentle reflection of the user's day, grounded ONLY in the supplied user-authored check-in (mood, energy, sleep, journal) and the typed same-day facts. Mirror back what they recorded in a warm, plain voice — invent no events, advice, plans, diagnoses, or emotions they did not express. One or two sentences.",
      prompt: JSON.stringify({ reflection: input, facts }),
      telemetry: { operation: "reflection-summary" },
    });
    const text = result.text.trim();
    if (!text) throw new Error("reflection summary was empty");
    return { text, provider: result.provider, modelId: result.modelId, usedFallback: false };
  } catch {
    return { text: factualFallback(input), provider: "deterministic", modelId: "local-fallback", usedFallback: true };
  }
}

export { factualFallback as deterministicReflectionSummary };
