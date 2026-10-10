/**
 * mcp/decisions.ts — Luna (Decisions API) second opinion for the MCP layer.
 *
 * One batched `decide()` per message. Answers may only:
 *   (a) DEMOTE a value that passed `verifyAgainstText` to a card (probability < 0.8), or
 *   (b) PICK one of the user's existing names for an unmatched name (confidence ≥ 0.85) —
 *       the pick is shown as a card for the user's OK, never auto-written.
 * Never promotes. Any provider failure → the deterministic fake answer (fail CLOSED).
 */
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from "@/core/contracts";
import { routeProposal, type Proposal } from "@/core/capture";
import { decisionProviderFromEnv, fakeAnswers } from "@/providers/decisions";

export const LUNA_PREDICATE_MIN = 0.8;
export const LUNA_CHOICE_MIN = 0.85;
const NONE = "none";
const MAX_CHOICES = 254;

export interface DecisionsSummary {
  provider: string;
  /** Live upstream calls made for this message (0 or 1). */
  calls: number;
  /** 1 when the answers came from the cache. */
  cached: number;
  /** Values Luna checked (predicates). */
  checked: number;
}

export function decisionsFor(override?: DecisionProvider, log?: (line: string) => void): DecisionProvider {
  return override ?? decisionProviderFromEnv(log);
}

/** Never throws: a provider error yields the deterministic answers, marked fallback. */
async function decideSafely(provider: DecisionProvider, input: string, questions: DecisionQuestion[]): Promise<DecisionAnswer[]> {
  if (questions.length === 0) return [];
  try {
    const answers = await provider.decide(input, questions);
    if (Array.isArray(answers) && answers.length === questions.length) return answers;
  } catch {
    /* fall through */
  }
  return fakeAnswers(input, questions).map((a) => ({ ...a, source: "fallback" as const }));
}

function summarize(provider: DecisionProvider, answers: readonly DecisionAnswer[], checked: number): DecisionsSummary {
  return {
    provider: provider.name,
    calls: answers.some((a) => a.source === "live") && provider.name !== "fake" ? 1 : 0,
    cached: answers.some((a) => a.source === "cache") ? 1 : 0,
    checked,
  };
}

function pct(p: number): number {
  return Math.round(p * 100);
}

/* ── (a) value predicates ───────────────────────────────────────────────── */

interface Stated {
  /** Canonical number token (what the fake looks for). */
  value: string;
  /** Human form, e.g. "₹450", "45 min", "420 kcal". */
  stated: string;
}

function paiseForm(paise: number): string {
  const p = paise % 100;
  const r = (paise - p) / 100;
  return p === 0 ? String(r) : `${r}.${String(p).padStart(2, "0")}`.replace(/0+$/, "");
}

function gramsForm(grams: number): string {
  const f = grams % 1000;
  const kg = (grams - f) / 1000;
  return f === 0 ? String(kg) : `${kg}.${String(f).padStart(3, "0")}`.replace(/0+$/, "");
}

function statedValues(p: Proposal): Stated[] {
  switch (p.kind) {
    case "transaction": {
      const v = paiseForm(p.payload.amountPaise);
      return [{ value: v, stated: `₹${v}` }];
    }
    case "meal": {
      const out: Stated[] = [{ value: String(p.payload.kcal), stated: `${p.payload.kcal} kcal` }];
      for (const [g, n] of [[p.payload.proteinGrams, "protein"], [p.payload.carbsGrams, "carbs"], [p.payload.fatGrams, "fat"]] as const) {
        if (g !== null) out.push({ value: String(g), stated: `${g} g ${n}` });
      }
      return out;
    }
    case "water":
      return p.payload.millilitres === null ? [] : [{ value: String(p.payload.millilitres), stated: `${p.payload.millilitres} ml` }];
    case "workout": {
      const out: Stated[] = [{ value: String(p.payload.durationMinutes), stated: `${p.payload.durationMinutes} min` }];
      if (p.payload.burnKcal !== null) out.push({ value: String(p.payload.burnKcal), stated: `${p.payload.burnKcal} kcal burned` });
      return out;
    }
    case "weighIn": {
      const v = gramsForm(p.payload.weightGrams);
      return [{ value: v, stated: `${v} kg` }];
    }
    case "skillSession":
      return [{ value: String(p.payload.minutes), stated: `${p.payload.minutes} min` }];
    case "habitLog":
      return [];
  }
}

function labelOf(p: Proposal): string {
  switch (p.kind) {
    case "transaction":
      return p.payload.note ?? p.payload.merchant ?? p.payload.categoryName;
    case "meal":
      return p.payload.note ?? "a meal";
    case "water":
      return "water";
    case "workout":
      return p.payload.note ?? p.payload.exercises[0]?.name ?? "a workout";
    case "weighIn":
      return "body weight";
    case "skillSession":
      return "skillName" in p.payload ? p.payload.skillName : "a skill session";
    case "habitLog":
      return "a habit";
  }
}

/* ── (b) name choices ──────────────────────────────────────────────────── */

type NameField = { field: "categoryName" | "habitName" | "skillName"; noun: string; names: readonly string[] };

function nameFieldOf(p: Proposal, names: { categories: string[]; habits: string[]; skills: string[] }): (NameField & { raw: string }) | null {
  if (p.kind === "transaction") return { field: "categoryName", noun: "money category", names: names.categories, raw: p.payload.categoryName };
  if (p.kind === "habitLog" && "habitName" in p.payload) return { field: "habitName", noun: "habit", names: names.habits, raw: p.payload.habitName };
  if (p.kind === "skillSession" && "skillName" in p.payload) return { field: "skillName", noun: "skill", names: names.skills, raw: p.payload.skillName };
  return null;
}

function withName(p: Proposal, field: NameField["field"], name: string): Proposal {
  return { ...p, payload: { ...p.payload, [field]: name } } as Proposal;
}

function demote(p: Proposal, reason: string, markEstimated: boolean): Proposal {
  return {
    ...p,
    estimated: markEstimated ? true : p.estimated,
    confidenceBps: Math.min(p.confidenceBps, 8999),
    why: { ...p.why, assumptions: [...p.why.assumptions, reason] },
  };
}

function choiceQuestion(name: string, noun: string, raw: string, existing: readonly string[]): DecisionQuestion {
  return {
    type: "choice",
    name,
    instructions: `The user mentioned the ${noun} "${raw}". Which of their EXISTING ${noun} names is it the same thing as? Answer "none" unless it is clearly the same.`,
    choices: [
      ...existing.slice(0, MAX_CHOICES).map((value) => ({ value, description: `The user's existing ${noun} "${value}".` })),
      { value: NONE, description: "None of these — a different thing." },
    ],
    candidate: raw,
  };
}

export interface LunaCheckResult {
  proposals: Proposal[];
  /** Extra card reasons per proposal (same order). */
  reasons: string[][];
  summary: DecisionsSummary | null;
}

/**
 * The single batched Luna call for one message. `proposals` are post-`verifyAgainstText`.
 * Returns possibly-demoted proposals (a name pick is always demoted to a card).
 */
export async function lunaCheck(
  provider: DecisionProvider,
  text: string,
  proposals: readonly Proposal[],
  names: { categories: string[]; habits: string[]; skills: string[] },
  log?: (line: string) => void,
): Promise<LunaCheckResult> {
  const questions: DecisionQuestion[] = [];
  const predicates: { index: number; q: string; stated: string }[] = [];
  const choices: { index: number; q: string; field: NameField["field"]; noun: string; raw: string }[] = [];
  const NO_BLOCKS = new Set<string>();

  proposals.forEach((p, index) => {
    const nf = nameFieldOf(p, names);
    const unmatched = nf !== null && !nf.names.some((n) => n.toLowerCase() === nf.raw.toLowerCase());
    if (nf && unmatched && nf.names.length > 0) {
      const q = `c${index}`;
      questions.push(choiceQuestion(q, nf.noun, nf.raw, nf.names));
      choices.push({ index, q, field: nf.field, noun: nf.noun, raw: nf.raw });
    }
    // Only values that passed the code check and would otherwise auto-file are worth a call.
    if (p.estimated || routeProposal(p, NO_BLOCKS).route !== "auto") return;
    statedValues(p).forEach((s, j) => {
      const q = `v${index}_${j}`;
      questions.push({
        type: "predicate",
        name: q,
        instructions: `The user explicitly stated ${s.stated} for ${labelOf(p)} — it is not an estimate.`,
        value: s.value,
      });
      predicates.push({ index, q, stated: s.stated });
    });
  });

  const out = { proposals: [...proposals], reasons: proposals.map(() => [] as string[]) };
  if (questions.length === 0) return { ...out, summary: null };

  const answers = await decideSafely(provider, text, questions);
  const byName = new Map(answers.map((a) => [a.name, a]));
  if (log) {
    for (const pr of predicates) {
      const a = byName.get(pr.q);
      log(`luna ${pr.stated}: ${a?.type === "predicate" ? `p=${a.probability.toFixed(3)}` : (a?.type ?? "missing")} (${a?.source ?? "?"})`);
    }
    for (const ch of choices) {
      const a = byName.get(ch.q);
      log(`luna "${ch.raw}" → ${a?.type === "choice" ? `${a.choice} conf=${a.confidence.toFixed(3)}` : (a?.type ?? "missing")} (${a?.source ?? "?"})`);
    }
  }

  for (const pr of predicates) {
    const a = byName.get(pr.q);
    if (a?.type !== "predicate" || a.probability >= LUNA_PREDICATE_MIN) continue;
    const reason = `Luna: ${pct(a.probability)}% likely you stated ${pr.stated}`;
    out.proposals[pr.index] = demote(out.proposals[pr.index], reason, true);
    out.reasons[pr.index].push(reason);
  }
  for (const ch of choices) {
    const a = byName.get(ch.q);
    if (a?.type !== "choice" || a.choice === NONE || a.confidence < LUNA_CHOICE_MIN) continue;
    const reason = `Luna matched "${ch.raw}" to your ${ch.noun} "${a.choice}" (${pct(a.confidence)}%) — tap Keep to confirm`;
    out.proposals[ch.index] = demote(withName(out.proposals[ch.index], ch.field, a.choice), reason, false);
    out.reasons[ch.index].push(reason);
  }
  return { ...out, summary: summarize(provider, answers, predicates.length) };
}

/** complete_todo title match: one Luna choice over today's open titles; ≥0.85 and not "none". */
export async function lunaPickTitle(
  provider: DecisionProvider,
  title: string,
  openTitles: readonly string[],
): Promise<{ title: string | null; confidence: number; summary: DecisionsSummary | null }> {
  if (openTitles.length === 0) return { title: null, confidence: 0, summary: null };
  const question = choiceQuestion("todo", "to-do", title, openTitles);
  const answers = await decideSafely(provider, `The user says they finished: "${title}"`, [question]);
  const a = answers[0];
  const summary = summarize(provider, answers, 0);
  if (a?.type !== "choice" || a.choice === NONE || a.confidence < LUNA_CHOICE_MIN || !openTitles.includes(a.choice)) {
    return { title: null, confidence: a?.type === "choice" ? a.confidence : 0, summary };
  }
  return { title: a.choice, confidence: a.confidence, summary };
}
