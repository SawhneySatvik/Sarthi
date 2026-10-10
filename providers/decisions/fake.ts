/**
 * Deterministic DecisionProvider (keyless). Also the fail-CLOSED fallback for the openai adapter.
 * - predicate → 0.99 when its `value` hint literally appears in the input (as a number token or
 *   a case-insensitive substring), else 0.05.
 * - choice → the exact case-insensitive match of its `candidate` hint among the choices
 *   (confidence 1.0), else "none" with confidence 0.0.
 */
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from "@/core/contracts";

/** "1,000" → "1000", "1.50" → "1.5", "007" → "7" (same normalisation as the code double-check). */
function normalizeNumber(raw: string): string {
  let n = raw.replace(/,/g, "");
  if (n.includes(".")) n = n.replace(/0+$/, "").replace(/\.$/, "");
  n = n.replace(/^0+(?=\d)/, "");
  return n;
}

function numberTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const match of text.matchAll(/\d+(?:[.,]\d+)*/g)) out.add(normalizeNumber(match[0]));
  return out;
}

function literallyIn(value: string, input: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^\d+(?:\.\d+)?$/.test(v)) return numberTokens(input).has(normalizeNumber(v));
  return input.toLowerCase().includes(v.toLowerCase());
}

export function fakeAnswers(input: string, questions: readonly DecisionQuestion[]): DecisionAnswer[] {
  return questions.map((q): DecisionAnswer => {
    if (q.type === "predicate") {
      return { type: "predicate", name: q.name, probability: q.value !== undefined && literallyIn(q.value, input) ? 0.99 : 0.05 };
    }
    const wanted = q.candidate?.trim().toLowerCase();
    const hit = wanted ? q.choices.find((c) => c.value !== "none" && c.value.toLowerCase() === wanted) : undefined;
    return hit
      ? { type: "choice", name: q.name, choice: hit.value, confidence: 1 }
      : { type: "choice", name: q.name, choice: "none", confidence: 0 };
  });
}

export function createFakeDecisionProvider(): DecisionProvider {
  return {
    name: "fake",
    async decide(input, questions) {
      return fakeAnswers(input, questions).map((a) => ({ ...a, source: "live" as const }));
    },
  };
}
