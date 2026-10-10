/**
 * OpenAI Decisions API adapter (`POST /v1/decisions`, model `gpt-6-luna`) via fetch.
 * Credits are limited, so: a hard per-process call cap, an in-memory cache keyed by
 * sha256(input + questions), a short timeout, and ANY failure/refusal → the deterministic
 * fake answer for that question (fail CLOSED: cards, never auto-writes). Fallbacks are not cached.
 */
import { createHash } from "node:crypto";

import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from "@/core/contracts";

import { fakeAnswers } from "./fake";

export const DECISIONS_MODEL = "gpt-6-luna";
const ENDPOINT = "https://api.openai.com/v1/decisions";

export interface OpenAiDecisionOptions {
  apiKey?: string | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxCalls?: number;
  endpoint?: string;
  log?: (line: string) => void;
}

export interface DecisionStats {
  calls: number;
  cached: number;
  fallbacks: number;
}

/** Upstream wire form: hints (`value`, `candidate`) stripped. */
function wireQuestion(q: DecisionQuestion): Record<string, unknown> {
  return q.type === "predicate"
    ? { type: "predicate", name: q.name, instructions: q.instructions }
    : { type: "choice", name: q.name, instructions: q.instructions, choices: q.choices };
}

function clamp01(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

export function createOpenAiDecisionProvider(options: OpenAiDecisionOptions = {}): DecisionProvider & { stats(): DecisionStats } {
  const apiKey = options.apiKey ?? null;
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2500;
  const maxCalls = options.maxCalls ?? 25;
  const endpoint = options.endpoint ?? ENDPOINT;
  const log = options.log ?? (() => undefined);
  const cache = new Map<string, DecisionAnswer[]>();
  const stats: DecisionStats = { calls: 0, cached: 0, fallbacks: 0 };

  const fallback = (input: string, questions: DecisionQuestion[], why: string): DecisionAnswer[] => {
    stats.fallbacks += 1;
    log(`decisions fallback (${why})`);
    return fakeAnswers(input, questions).map((a) => ({ ...a, source: "fallback" as const }));
  };

  return {
    name: "openai",
    stats: () => ({ ...stats }),
    async decide(input, questions) {
      if (questions.length === 0) return [];
      const wire = questions.map(wireQuestion);
      const key = createHash("sha256").update(input).update("\u0000").update(JSON.stringify(wire)).digest("hex");
      const hit = cache.get(key);
      if (hit) {
        stats.cached += 1;
        return hit.map((a) => ({ ...a, source: "cache" as const }));
      }
      if (!apiKey) return fallback(input, questions, "no key");
      if (stats.calls >= maxCalls) return fallback(input, questions, `cap ${maxCalls} reached`);
      stats.calls += 1; // counted BEFORE the request: a timed-out call may still be billed

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let body: unknown;
      try {
        const response = await doFetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: DECISIONS_MODEL, input, questions: wire }),
          signal: controller.signal,
        });
        if (!response.ok) return fallback(input, questions, `http ${response.status}`);
        body = await response.json();
      } catch (error) {
        return fallback(input, questions, (error as Error)?.name === "AbortError" ? "timeout" : "network");
      } finally {
        clearTimeout(timer);
      }

      const raw = (body as { answers?: unknown })?.answers;
      if (!Array.isArray(raw)) return fallback(input, questions, "malformed");
      const byName = new Map<string, Record<string, unknown>>();
      for (const a of raw) if (a && typeof a === "object" && typeof (a as { name?: unknown }).name === "string") byName.set((a as { name: string }).name, a as Record<string, unknown>);
      const fallbackAnswers = fakeAnswers(input, questions);
      let degraded = false;
      const answers = questions.map((q, i): DecisionAnswer => {
        const a = byName.get(q.name);
        if (!a || a.type === "refusal") {
          degraded = true;
          return { ...fallbackAnswers[i], source: "fallback" };
        }
        if (q.type === "predicate" && a.type === "predicate") {
          const p = clamp01(a.probability);
          if (p !== null) return { type: "predicate", name: q.name, probability: p, source: "live" };
        }
        if (q.type === "choice" && a.type === "choice" && typeof a.choice === "string") {
          const c = clamp01(a.confidence);
          const known = q.choices.some((choice) => choice.value === a.choice);
          if (c !== null && known) return { type: "choice", name: q.name, choice: a.choice as string, confidence: c, source: "live" };
        }
        degraded = true;
        return { ...fallbackAnswers[i], source: "fallback" };
      });
      if (!degraded) cache.set(key, answers);
      else stats.fallbacks += 1;
      return answers;
    },
  };
}
