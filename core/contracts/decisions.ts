/**
 * DecisionProvider — a provider-blind port for small, batched classification questions
 * (OpenAI Decisions API shape: predicates + choices over one shared input). Type-only.
 *
 * Contract: answers may only DEMOTE (send a value to a card) or PICK among names the user
 * already has — never promote an estimate to explicit, never invent a name.
 */
export type DecisionProviderName = "fake" | "openai";

export interface DecisionPredicate {
  type: "predicate";
  name: string;
  instructions: string;
  /** Fake-only hint: the literal the deterministic adapter looks for in the input. Not sent upstream. */
  value?: string;
}

export interface DecisionChoice {
  type: "choice";
  name: string;
  instructions: string;
  choices: { value: string; description: string }[];
  /** Fake-only hint: the raw name to match exactly (case-insensitive). Not sent upstream. */
  candidate?: string;
}

export type DecisionQuestion = DecisionPredicate | DecisionChoice;

/** Where an answer came from: a live upstream call, the in-memory cache, or the deterministic fallback. */
export type DecisionSource = "live" | "cache" | "fallback";

export type DecisionAnswer =
  | { type: "predicate"; name: string; probability: number; source?: DecisionSource }
  | { type: "choice"; name: string; choice: string; confidence: number; source?: DecisionSource }
  | { type: "refusal"; name: string; source?: DecisionSource };

export interface DecisionProvider {
  readonly name: DecisionProviderName;
  decide(input: string, questions: DecisionQuestion[]): Promise<DecisionAnswer[]>;
}
