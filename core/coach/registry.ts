import type { DateRange, DomainCoachContext, DomainEvent, DomainSpec, PlanEffect } from "./contract";
import type { UserScopedRepositories } from "@/core/contracts";

function inRange(localDate: string, range: DateRange): boolean {
  return localDate >= range.start && localDate <= range.end;
}

function ordered<T extends { localDate: string; id: string }>(rows: readonly T[]): T[] {
  return rows.slice().sort((a, b) => a.localDate.localeCompare(b.localDate) || a.id.localeCompare(b.id)).slice(0, 12);
}

/** One typed, read-only hook reused by the four registry entries — no fifth coach. */
async function activePlanEffects(input: DomainEvent, repos: UserScopedRepositories): Promise<readonly PlanEffect[]> {
  return (await repos.plans.items.list({}))
    .filter((item) => item.domain === input.domain && (item.status === "pending" || item.status === "active"))
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.id.localeCompare(b.id))
    .map((item) => ({ planItemId: item.id, domain: input.domain, status: item.status, completionSource: item.completionSource }));
}

export const DOMAIN_REGISTRY = [
  {
    domain: "health",
    proposalKinds: ["meal", "water", "workout", "weighIn"],
    parseHints: "Meals, water, workouts, and weigh-ins use explicit integer quantities.",
    coachInstructions: "Reflect observed health entries without medical advice or invented targets.",
    allowedTools: ["read-domain-evidence", "read-progress", "read-plan", "propose-adaptation"],
    evaluatePlanEffects: (input, repos) => activePlanEffects(input, repos),
    async contextLoader(repos: UserScopedRepositories, range: DateRange): Promise<DomainCoachContext> {
      const [meals, water, workouts, weighIns] = await Promise.all([
        repos.health.meals.list({}), repos.health.waterLogs.list({}), repos.health.workouts.list({}), repos.health.weighIns.list({}),
      ]);
      const evidence = [
        ...ordered(meals.filter((row) => inRange(row.localDate, range))).map((row) => ({ domain: "health" as const, entryKind: "meal", entryId: row.id, label: row.note ?? "Meal", valueInt: row.kcal, unit: "kcal" })),
        ...ordered(water.filter((row) => inRange(row.localDate, range))).map((row) => ({ domain: "health" as const, entryKind: "water", entryId: row.id, label: "Water", valueInt: row.millilitres, unit: "ml" })),
        ...ordered(workouts.filter((row) => inRange(row.localDate, range))).map((row) => ({ domain: "health" as const, entryKind: "workout", entryId: row.id, label: "Workout", valueInt: row.durationMinutes, unit: "minutes" })),
        ...ordered(weighIns.filter((row) => inRange(row.localDate, range))).map((row) => ({ domain: "health" as const, entryKind: "weighIn", entryId: row.id, label: "Weigh-in", valueInt: row.weightGrams, unit: "grams" })),
      ];
      return { domain: "health", entryCount: evidence.length, evidence };
    },
  },
  {
    domain: "money",
    proposalKinds: ["transaction"],
    parseHints: "Transactions require integer paise and an explicit direction.",
    coachInstructions: "Use only recorded ledger evidence; do not give financial advice or invent a balance.",
    allowedTools: ["read-domain-evidence", "read-progress", "read-plan"],
    evaluatePlanEffects: (input, repos) => activePlanEffects(input, repos),
    async contextLoader(repos: UserScopedRepositories, range: DateRange): Promise<DomainCoachContext> {
      const rows = ordered((await repos.money.transactions.list({})).filter((row) => inRange(row.localDate, range)));
      const evidence = rows.map((row) => ({ domain: "money" as const, entryKind: "transaction", entryId: row.id, label: row.merchant ?? row.note ?? "Transaction", valueInt: row.amountPaise, unit: "paise" }));
      return { domain: "money", entryCount: evidence.length, evidence };
    },
  },
  {
    domain: "habits",
    proposalKinds: ["habitLog"],
    parseHints: "Habit logs must match an existing habit and stay pending when ambiguous.",
    coachInstructions: "Describe logged habit states without judgment; never silently change a habit or plan.",
    allowedTools: ["read-domain-evidence", "read-progress", "read-plan", "propose-adaptation"],
    evaluatePlanEffects: (input, repos) => activePlanEffects(input, repos),
    async contextLoader(repos: UserScopedRepositories, range: DateRange): Promise<DomainCoachContext> {
      const rows = ordered((await repos.habits.logs.list({})).filter((row) => inRange(row.localDate, range)));
      const evidence = rows.map((row) => ({ domain: "habits" as const, entryKind: "habitLog", entryId: row.id, label: row.status, valueInt: null, unit: null }));
      return { domain: "habits", entryCount: evidence.length, evidence };
    },
  },
  {
    domain: "skills",
    proposalKinds: ["skillSession"],
    parseHints: "Skill sessions require a matched existing skill and integer minutes.",
    coachInstructions: "Ground skill feedback in recorded practice minutes and named milestones only.",
    allowedTools: ["read-domain-evidence", "read-progress", "read-plan", "propose-adaptation"],
    evaluatePlanEffects: (input, repos) => activePlanEffects(input, repos),
    async contextLoader(repos: UserScopedRepositories, range: DateRange): Promise<DomainCoachContext> {
      const rows = ordered((await repos.skills.sessions.list({})).filter((row) => inRange(row.localDate, range)));
      const evidence = rows.map((row) => ({ domain: "skills" as const, entryKind: "skillSession", entryId: row.id, label: "Practice", valueInt: row.minutes, unit: "minutes" }));
      return { domain: "skills", entryCount: evidence.length, evidence };
    },
  },
] as const satisfies readonly DomainSpec[];

if (DOMAIN_REGISTRY.length !== 4 || new Set(DOMAIN_REGISTRY.map((spec) => spec.domain)).size !== 4) {
  throw new Error("Coach registry must contain exactly health, money, habits, and skills");
}
