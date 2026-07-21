/**
 * core/tools/afford.ts — the "Afford-it check" (SAR-017 T4, D-017 → Money).
 *
 * A DEEP-TIER verdict grounded in the real ledger: given what the user wants to buy and
 * its explicit price, it answers "can you afford this right now?" over the three
 * safe-to-spend terms from `buildMoneyView` (balance − remaining-budgeted −
 * upcoming-recurring). The verdict is ADVICE ONLY — it never writes; only an explicit
 * "Bought it → log" tap commits (via the standard capture path). Framework-clean: imports
 * only zod + other `core/*` modules, so it stays extractable and provider-blind.
 *
 * Keyless-first: `buildAffordPrompt` embeds a parseable JSON envelope so the deterministic
 * `fake` gateway can `deriveAffordVerdict` the same grounded answer with no API key, while
 * a real Gemini/GPT model reads the same context through the tier gateway.
 */
import { z } from "zod";

import type { LlmGateway, UserScopedRepositories } from "@/core/contracts";
import { buildMoneyView, formatPaise } from "@/core/domains/money";

export const affordRatingEnum = z.enum(["comfortable", "tight", "not_now"]);
export type AffordRating = z.infer<typeof affordRatingEnum>;

/**
 * The verdict shape the deep tier returns. Deliberately a PLAIN object (no discriminated
 * union) so the Google JSON-text structured-output path validates cleanly.
 */
export const affordVerdictSchema = z.object({
  rating: affordRatingEnum,
  reason: z.string().min(1).max(280),
});
export type AffordVerdict = z.infer<typeof affordVerdictSchema>;

/** The user's explicit ask: a labelled item + a strictly positive integer paise price. */
export const affordInputSchema = z.object({
  item: z.string().trim().min(1).max(80),
  pricePaise: z.number().int().positive(),
});
export type AffordInput = z.infer<typeof affordInputSchema>;

/** The glass-box context the verdict is grounded in — the three safe-to-spend terms + data age. */
export interface AffordContext {
  item: string;
  pricePaise: number;
  safeToSpendPaise: number;
  balancePaise: number;
  remainingBudgetedPaise: number;
  upcomingRecurringPaise: number;
  /** Distinct days of ledger history — under 7 prefaces the verdict as an early guess (§3c). */
  dataDays: number;
}

export interface AffordCategoryOption {
  id: string;
  name: string;
}

export interface AffordAssessment {
  verdict: AffordVerdict;
  context: AffordContext;
  /** The user's real money categories, so "Bought it → log" resolves to an existing one. */
  categories: AffordCategoryOption[];
  modelProvider: string;
  modelId: string;
}

const AFFORD_SYSTEM =
  "You are Sarthi's Money coach answering exactly one question: can the user afford this " +
  "purchase right now? You are given their real ledger as JSON — safeToSpendPaise (their " +
  "balance minus money already budgeted minus upcoming recurring bills), the three terms that " +
  "compose it, the item, its price, and dataDays (days of history seen). All amounts are " +
  "integer paise (100 paise = ₹1). Choose rating 'comfortable' when the price sits well " +
  "within safe-to-spend, 'tight' when it fits but leaves little room or a bill is still due, " +
  "and 'not_now' when it exceeds safe-to-spend. Write ONE short grounded sentence for reason, " +
  "referencing the real numbers — calm, never preachy, no advice beyond the verdict. If " +
  "dataDays is under 7, say it is an early guess. Return only rating and reason.";

/** Build the deep-tier request. The prompt is a JSON envelope both a real model and the fake read. */
export function buildAffordPrompt(context: AffordContext): { system: string; prompt: string } {
  return { system: AFFORD_SYSTEM, prompt: JSON.stringify({ afford: context }) };
}

/** Read the ledger envelope back out of a prompt (the keyless fake dispatch). */
export function readAffordEnvelope(prompt: string): AffordContext | null {
  try {
    const parsed = JSON.parse(prompt) as { afford?: Partial<AffordContext> };
    const a = parsed.afford;
    if (
      !a ||
      typeof a.pricePaise !== "number" ||
      typeof a.safeToSpendPaise !== "number" ||
      typeof a.upcomingRecurringPaise !== "number" ||
      typeof a.dataDays !== "number"
    ) {
      return null;
    }
    return a as AffordContext;
  } catch {
    return null;
  }
}

/**
 * Deterministic, ledger-grounded verdict — the keyless answer, and the reference the real
 * model is prompted to match. Genuinely varies with price vs safe-to-spend (like the
 * answer-derived onboarding spine), so the fake loop is meaningful, not a fixed string.
 */
export function deriveAffordVerdict(context: AffordContext): AffordVerdict {
  const { pricePaise, safeToSpendPaise, upcomingRecurringPaise, dataDays } = context;
  const early = dataDays < 7 ? `Early guess — I've only seen ${dataDays} day${dataDays === 1 ? "" : "s"}. ` : "";
  const remaining = safeToSpendPaise - pricePaise;

  if (pricePaise > safeToSpendPaise) {
    return {
      rating: "not_now",
      reason: `${early}${formatPaise(pricePaise)} is more than your ${formatPaise(safeToSpendPaise)} safe-to-spend right now.`,
    };
  }
  if (pricePaise * 2 > safeToSpendPaise || upcomingRecurringPaise > 0) {
    return {
      rating: "tight",
      reason:
        upcomingRecurringPaise > 0
          ? `${early}It fits, but ${formatPaise(upcomingRecurringPaise)} of bills still post this month — you'd have ${formatPaise(remaining)} left.`
          : `${early}It fits, but only ${formatPaise(remaining)} would remain of your safe-to-spend.`,
    };
  }
  return {
    rating: "comfortable",
    reason: `${early}Yes — ${formatPaise(pricePaise)} sits comfortably within your ${formatPaise(safeToSpendPaise)} safe-to-spend.`,
  };
}

/**
 * Assess affordability over the bound user scope: read the month's typed money rows,
 * derive the three safe-to-spend terms with `buildMoneyView`, and ask the deep tier
 * (keyless or live) for a grounded verdict. Read-only — no write happens here.
 */
export async function assessAfford(options: {
  repos: UserScopedRepositories;
  llm: LlmGateway;
  localDate: string;
  input: AffordInput;
}): Promise<AffordAssessment> {
  const { repos, llm, localDate } = options;
  const input = affordInputSchema.parse(options.input);

  const [transactions, categories, budgets, recurringRules] = await Promise.all([
    repos.money.transactions.list({}),
    repos.money.categories.list({}),
    repos.money.budgets.list({}),
    repos.money.recurringRules.list({ isPaused: false }),
  ]);
  const money = buildMoneyView({ localDate, transactions, categories, budgets, recurringRules });
  const dataDays = new Set(transactions.map((t) => t.localDate)).size;

  const context: AffordContext = {
    item: input.item,
    pricePaise: input.pricePaise,
    safeToSpendPaise: money.safeToSpend.valuePaise,
    balancePaise: money.safeToSpend.balancePaise,
    remainingBudgetedPaise: money.safeToSpend.remainingBudgetedPaise,
    upcomingRecurringPaise: money.safeToSpend.upcomingRecurringPaise,
    dataDays,
  };

  const { system, prompt } = buildAffordPrompt(context);
  const result = await llm.generateObject({
    tier: "deep",
    schema: affordVerdictSchema,
    system,
    prompt,
    telemetry: { operation: "afford-check" },
  });

  return {
    verdict: result.object,
    context,
    // A purchase is an expense — only expense categories are sensible for "Bought it → log",
    // so an income category (e.g. Salary) can never become the default an expense files under.
    categories: categories.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, name: c.name })),
    modelProvider: result.provider,
    modelId: result.modelId,
  };
}
