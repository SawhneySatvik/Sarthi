/**
 * tests/eval/coach-fixtures.ts — COACH-2 eval support (keyless). Seed helpers plus the
 * grounding-metric utilities the coach-agent eval asserts on. No network, no keys.
 *
 * The grounding check is computed from the CAPTURED step envelopes + the persisted coach
 * answer, so it exercises the real `converse` path end-to-end: every integer a grounded
 * fake answer may contain is derivable from a tool result (valueInts / per-unit sums /
 * entry counts / tool-computed resultSummary integers) or from a surfaced memory (the
 * user's own words). Any integer in the answer outside that universe is a fabricated claim.
 */
import type { LlmGateway, UserScopedRepositories } from "../../core/contracts";
import { readAgentStepEnvelope, type CoachAgentEnvelope } from "../../core/coach/agent";

/** The eval turn's local day (matches the harness's EVAL_NOW date). */
export const COACH_EVAL_LOCAL_DATE = "2026-07-18";

/** A capturing gateway: forwards to the fake, recording every coach-agent-step prompt. */
export function capturingGateway(inner: LlmGateway, prompts: string[]): LlmGateway {
  return {
    async generateObject(request) {
      if (request.telemetry.operation === "coach-agent-step") prompts.push(request.prompt);
      return inner.generateObject(request);
    },
    generateText: (request) => inner.generateText(request),
  };
}

/** Parse the (fenced) step envelopes back out of the captured prompts; drop any malformed. */
export function envelopesFromPrompts(prompts: readonly string[]): CoachAgentEnvelope[] {
  return prompts.map(readAgentStepEnvelope).filter((env): env is CoachAgentEnvelope => env !== null);
}

function stripFenceLoose(text: string): string {
  return text.replace(/⟦\/?untrusted⟧/g, "");
}

/** Every integer token in `text`, comma-grouping tolerated ("₹5,000" → 5000). */
export function extractInts(text: string): number[] {
  const out: number[] = [];
  for (const match of stripFenceLoose(text).matchAll(/\d[\d,]*/g)) {
    const value = Number(match[0].replace(/,/g, ""));
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

/**
 * The universe of integers a grounded fake answer may legitimately contain for a turn:
 * every tool result's valueInts + per-unit sums + entry counts + the tool-computed
 * resultSummary integers, plus integers in the surfaced memories. `deriveGroundedAnswer`
 * only ever composes from exactly these, so any integer in the answer outside this set is
 * an ungrounded (fabricated) claim — the regression this metric guards against.
 */
export function groundedIntUniverse(envelopes: readonly CoachAgentEnvelope[]): Set<number> {
  const universe = new Set<number>();
  for (const env of envelopes) {
    for (const entry of env.toolLog) {
      universe.add(entry.entries.length);
      const byUnit = new Map<string, number>();
      for (const row of entry.entries) {
        if (typeof row.valueInt === "number") {
          universe.add(row.valueInt);
          if (row.unit) byUnit.set(row.unit, (byUnit.get(row.unit) ?? 0) + row.valueInt);
        }
      }
      for (const total of byUnit.values()) universe.add(total);
      for (const value of extractInts(entry.resultSummary)) universe.add(value);
    }
    for (const memory of [...env.memories.pinned, ...env.memories.ranked]) {
      for (const value of extractInts(memory.text)) universe.add(value);
    }
  }
  return universe;
}

/** Count integers in the answer that are NOT derivable from the grounded universe. */
export function ungroundedNumericClaims(answer: string, universe: Set<number>): number {
  return extractInts(answer).filter((value) => !universe.has(value)).length;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Keyless seed helpers (integer units only — paise / minutes).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Three in-window debits (2026-07-12 … 2026-07-18) so the money read sums deterministically. */
export async function seedMoneyWindow(repos: UserScopedRepositories, amountsPaise: readonly number[]): Promise<void> {
  const dates = ["2026-07-18", "2026-07-16", "2026-07-14"];
  for (let i = 0; i < amountsPaise.length; i++) {
    const localDate = dates[i % dates.length];
    await repos.money.transactions.create({
      occurredAt: `${localDate}T05:20:00.000Z`,
      localDate,
      timezone: "UTC",
      direction: "debit",
      amountPaise: amountsPaise[i],
      categoryId: null,
      merchant: "Cafe",
      note: null,
      source: "capture",
      confidenceBps: 10000,
      estimated: false,
      evidenceId: null,
      recurringRuleId: null,
    });
  }
}

/** A couple of progress rows so `read-progress` grounds against real streaks/inactive days. */
export async function seedProgress(repos: UserScopedRepositories): Promise<void> {
  await repos.plans.progress.create({ domain: "skills", xp: 260, level: 2, streak: 6, bestStreak: 6, cumulativeMinutes: 900, lastActiveDate: COACH_EVAL_LOCAL_DATE });
  await repos.plans.progress.create({ domain: "health", xp: 120, level: 2, streak: 4, bestStreak: 4, cumulativeMinutes: 0, lastActiveDate: COACH_EVAL_LOCAL_DATE });
}

async function seedPlanItem(
  repos: UserScopedRepositories,
  domain: "health" | "money",
  targetValue: number,
  targetUnit: string,
): Promise<string> {
  const arc = await repos.plans.arcs.create({
    domain,
    mode: "build",
    title: `${domain} arc`,
    startDate: COACH_EVAL_LOCAL_DATE,
    endDate: null,
    dayNumber: 1,
    status: "active",
  });
  const item = await repos.plans.items.create({
    arcId: arc.id,
    domain,
    kind: "target",
    title: domain === "money" ? "Weekly spend cap" : "Evening walk",
    dueAt: null,
    localDate: COACH_EVAL_LOCAL_DATE,
    targetValue,
    targetUnit,
    status: "active",
    completionSource: null,
    ruleJson: null,
    linkedHabitId: null,
    linkedSkillId: null,
  });
  return item.id;
}

/** An adjustable health target (the coach may propose a lower value). Returns the item id. */
export function seedHealthPlanItem(repos: UserScopedRepositories, targetValue: number): Promise<string> {
  return seedPlanItem(repos, "health", targetValue, "minutes");
}

/** A money target the coach may NEVER adjust (money excludes propose-adaptation). */
export function seedMoneyPlanItem(repos: UserScopedRepositories, targetValuePaise: number): Promise<string> {
  return seedPlanItem(repos, "money", targetValuePaise, "paise");
}

/**
 * One OLD pinned `goal` + more than K=8 non-pinned fillers. Without the pinned floor the
 * goal would be evicted from the top-K every turn; with it, `selectMemories` returns it in
 * `memories.pinned` unconditionally — the `pinnedGoalRetention` invariant. Returns the goal
 * text so the eval can assert its presence in every captured envelope.
 */
export async function seedMemories(repos: UserScopedRepositories): Promise<{ goalText: string }> {
  const goalText = "Save ₹5,000 every month";
  await repos.coach.memory.create({
    domain: "money",
    kind: "goal",
    text: goalText,
    pinned: true,
    estimated: false,
    confidenceBps: 10000,
    sourceCaptureId: null,
    lastUsedAt: "2026-01-01T00:00:00.000Z",
  });
  for (let i = 0; i < 10; i++) {
    await repos.coach.memory.create({
      domain: i % 2 === 0 ? "money" : "global",
      kind: "observation",
      text: `recent filler observation ${i}`,
      pinned: false,
      estimated: false,
      confidenceBps: 9000,
      sourceCaptureId: null,
    });
  }
  return { goalText };
}
