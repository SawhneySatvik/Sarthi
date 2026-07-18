/**
 * core/onboarding/spine.ts — SAR-012 Pass 2 (D-E).
 *
 * The per-domain spine contract + `deriveSpine`, the DETERMINISTIC answer-derived
 * builder. Framework-clean (zod + core DTO enums only, invariant #9): imported by BOTH
 * the accept validator (core) AND the fake gateway (providers → core, the same direction
 * as fake→core/contracts today), so the keyless spines genuinely vary with the answers.
 *
 * Glass-box (P4 acceptance): every quantity here is COMPUTED from a B answer —
 * `timeBudgetMinutes` scales session/target minutes, `dayShape`+wake/sleep shape the
 * cadence/timing, the B5 goal chips pick what appears, the named skill is verbatim, and
 * the under-18 branch (§10) switches Health to conservative defaults with no weight-loss
 * framing. The `headerLine` is composed from the same inputs, so "the confirm cards
 * clearly derive from the answers" is a computed property, not copywriting.
 *
 * Integer units only (invariant #2): every target/limit is `z.number().int()` — kcal,
 * millilitres, minutes, grams, and money as integer PAISE. No float ever.
 */
import { z } from "zod";

import { cadenceEnum, categoryKindEnum, domainEnum, planItemKindEnum } from "@/data/schema/contract";

import { clockLabel, DAY_SHAPES, type CoreAnswers } from "./contract";

/* ────────────────────────────────────────────────────────────────────────────
 * 1. The four buildable domains (excludes `overall`, which has no spine).
 * ────────────────────────────────────────────────────────────────────────── */

export const spineDomainEnum = z.enum(["health", "money", "habits", "skills"]);
export type SpineDomain = z.infer<typeof spineDomainEnum>;
export const SPINE_DOMAINS = spineDomainEnum.options;

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Per-domain spine schemas (discriminated on `domain`; all quantities ints).
 * ────────────────────────────────────────────────────────────────────────── */

/** User-editable free-text fields (habit/category/skill names, plan-item titles, milestone
 *  labels, headerLine) are re-validated server-side: trimmed, non-empty, bounded — so a blanked
 *  editor row can never persist an empty-named typed row (CF-6). */
const spineName = z.string().trim().min(1).max(80);
// Plan-item titles compose a name ("Practise <skill> for 30 min"), so they get more headroom.
const spineTitle = z.string().trim().min(1).max(120);
const spineHeaderLine = z.string().trim().min(1).max(200);

/** A derived Day-1 plan item within a domain spine. `linkHabitName`/`linkSkillName`
 *  are resolved to `linkedHabitId`/`linkedSkillId` at accept, after the rows exist. */
export const spinePlanItemSchema = z.object({
  kind: planItemKindEnum,
  title: spineTitle,
  targetValue: z.number().int().nullable(),
  targetUnit: z.string().nullable(),
  linkHabitName: z.string().nullable(),
  linkSkillName: z.string().nullable(),
});
export type SpinePlanItem = z.infer<typeof spinePlanItemSchema>;

/** A cross-domain satisfaction rule seed (mirrors habit_satisfaction_rules). */
const spineSatisfactionRuleSchema = z.object({
  sourceDomain: domainEnum,
  sourceKind: z.string(),
  aggregateField: z.string(),
  minimumValue: z.number().int(),
  unit: z.string().nullable(),
});

export const healthSpineSchema = z.object({
  domain: z.literal("health"),
  headerLine: spineHeaderLine,
  // Health targets ARE its Day-1 plan items (kcal / waterMl / workout-minutes).
  targets: z.array(
    z.object({
      kind: z.enum(["target", "checkin"]),
      title: spineTitle,
      targetValue: z.number().int().nullable(),
      targetUnit: z.string().nullable(),
    }),
  ),
});
export type HealthSpine = z.infer<typeof healthSpineSchema>;

export const habitsSpineSchema = z.object({
  domain: z.literal("habits"),
  headerLine: spineHeaderLine,
  habits: z.array(
    z.object({
      name: spineName,
      cadence: cadenceEnum,
      difficulty: z.string(),
      targetValue: z.number().int().nullable(),
      targetUnit: z.string().nullable(),
      satisfactionRule: spineSatisfactionRuleSchema.nullable(),
    }),
  ),
  items: z.array(spinePlanItemSchema),
});
export type HabitsSpine = z.infer<typeof habitsSpineSchema>;

export const moneySpineSchema = z.object({
  domain: z.literal("money"),
  headerLine: spineHeaderLine,
  categories: z.array(
    z.object({
      name: spineName,
      kind: categoryKindEnum,
      monthlyLimitPaise: z.number().int().nonnegative().nullable(),
    }),
  ),
  items: z.array(spinePlanItemSchema),
});
export type MoneySpine = z.infer<typeof moneySpineSchema>;

export const skillsSpineSchema = z.object({
  domain: z.literal("skills"),
  headerLine: spineHeaderLine,
  skill: z.object({
    name: spineName,
    targetMinutes: z.number().int().nullable(),
  }),
  milestones: z.array(spineName),
  items: z.array(spinePlanItemSchema),
});
export type SkillsSpine = z.infer<typeof skillsSpineSchema>;

export const domainSpineSchema = z.discriminatedUnion("domain", [
  healthSpineSchema,
  habitsSpineSchema,
  moneySpineSchema,
  skillsSpineSchema,
]);
export type DomainSpine = z.infer<typeof domainSpineSchema>;

/** The per-domain schema the gateway validates the spine against (D-E: the caller's schema). */
export function spineSchemaFor(domain: SpineDomain) {
  switch (domain) {
    case "health":
      return healthSpineSchema;
    case "money":
      return moneySpineSchema;
    case "habits":
      return habitsSpineSchema;
    case "skills":
      return skillsSpineSchema;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Which domains the B5 answers selected (drives which spines generate).
 * ────────────────────────────────────────────────────────────────────────── */

/** The domains the user picked in B5 — a chip in that domain, or a named skill. */
export function selectedSpineDomains(answers: CoreAnswers): SpineDomain[] {
  const { goals } = answers;
  const domains: SpineDomain[] = [];
  if (goals.health.length > 0) domains.push("health");
  if (goals.money.length > 0) domains.push("money");
  if (goals.habits.length > 0) domains.push("habits");
  if (goals.skillName !== null && goals.skillName.trim().length > 0) domains.push("skills");
  return domains;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. deriveSpine — the deterministic, answer-derived builder.
 * ────────────────────────────────────────────────────────────────────────── */

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const dayShapeLabel = (answers: CoreAnswers): string =>
  DAY_SHAPES.find((shape) => shape.id === answers.dayShape)?.label ?? answers.dayShape;

/** Whole years old from a `YYYY-MM-DD` birthDate. `new Date()` is the only "now" (not a
 *  framework import); deterministic tests use birthdates far from the 18-year boundary, so
 *  this never flakes on the clock — the same caveat contract.ts's `todayIsoLocal` carries. */
function ageFromBirthDate(birthDate: string): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  let age = now.getFullYear() - year;
  if (nowMonth < month || (nowMonth === month && now.getDate() < day)) {
    age -= 1;
  }
  return age;
}

/** The header line every card shows in Fraunces (glass-box: names the driving answers). */
function headerLine(answers: CoreAnswers, tail: string): string {
  return `Based on your ${answers.timeBudgetMinutes} minutes and ${dayShapeLabel(answers)} — ${tail}`;
}

function deriveHealthSpine(answers: CoreAnswers): HealthSpine {
  const weightKg = Math.round(answers.weightGrams / 1000);
  const under18 = ageFromBirthDate(answers.birthDate) < 18;
  const wantsEat = answers.goals.health.includes("eat_better");
  const wantsGym = answers.goals.health.includes("gym");
  const wantsWeight = answers.goals.health.includes("weight");

  // Maintenance from bodyweight; a gentle deficit ONLY for adults who chose the weight goal.
  const maintenanceKcal = weightKg * 30;
  // Clamp to a responsible daily range so a light adult's deficit never falls below a safe floor.
  const kcalTarget = clamp(under18 || !wantsWeight ? maintenanceKcal : maintenanceKcal - 300, 1400, 4000);
  // Water scales with bodyweight, rounded to a friendly 250 ml step, bounded.
  const waterMl = clamp(Math.round((weightKg * 35) / 250) * 250, 2000, 4000);
  // Movement scales with the daily time budget, capped at an hour.
  const workoutMinutes = clamp(answers.timeBudgetMinutes, 15, 60);

  const targets: HealthSpine["targets"] = [
    { kind: "target", title: "Water", targetValue: waterMl, targetUnit: "ml" },
  ];
  if (wantsEat || wantsWeight) {
    targets.push({
      kind: "checkin",
      title: "Daily energy",
      targetValue: kcalTarget,
      targetUnit: "kcal",
    });
  }
  if (wantsGym || wantsWeight) {
    targets.push({
      kind: "target",
      title: "Movement",
      targetValue: workoutMinutes,
      targetUnit: "minutes",
    });
  }
  if (wantsWeight && !under18) {
    targets.push({ kind: "checkin", title: "Log a weigh-in", targetValue: null, targetUnit: null });
  }

  return {
    domain: "health",
    headerLine: headerLine(answers, under18 ? "gentle targets to build from." : "here's a start."),
    targets,
  };
}

function deriveHabitsSpine(answers: CoreAnswers): HabitsSpine {
  const wantsWakeEarly = answers.goals.habits.includes("wake_early");
  const wantsRoutine = answers.goals.habits.includes("routine");
  const wantsFocus = answers.goals.habits.includes("focus");
  const focusMinutes = clamp(answers.timeBudgetMinutes, 15, 90);

  const habits: HabitsSpine["habits"] = [];
  if (wantsWakeEarly) {
    habits.push({
      name: `Wake by ${clockLabel(answers.wakeTimeMinutes)}`,
      cadence: "daily",
      difficulty: "medium",
      targetValue: null,
      targetUnit: null,
      satisfactionRule: null,
    });
  }
  if (wantsRoutine) {
    habits.push({
      name: `Wind down by ${clockLabel(answers.sleepTimeMinutes)}`,
      cadence: "daily",
      difficulty: "easy",
      targetValue: null,
      targetUnit: null,
      satisfactionRule: null,
    });
  }
  if (wantsFocus) {
    habits.push({
      name: `Focus block (${focusMinutes} min)`,
      cadence: "daily",
      difficulty: "medium",
      targetValue: focusMinutes,
      targetUnit: "minutes",
      satisfactionRule: null,
    });
  }

  const items: SpinePlanItem[] = habits.map((habit) => ({
    kind: "task",
    title: habit.name,
    targetValue: habit.targetValue,
    targetUnit: habit.targetUnit,
    linkHabitName: habit.name,
    linkSkillName: null,
  }));

  return {
    domain: "habits",
    headerLine: headerLine(answers, "a routine to anchor the day."),
    habits,
    items,
  };
}

function deriveMoneySpine(answers: CoreAnswers): MoneySpine {
  const wantsBudget = answers.goals.money.includes("budget");
  const wantsLeaks = answers.goals.money.includes("stop_leaks");
  const limit = (paise: number): number | null => (wantsBudget ? paise : null);

  const categories: MoneySpine["categories"] = [
    { name: "Food & dining", kind: "expense", monthlyLimitPaise: limit(800000) },
    { name: "Transport", kind: "expense", monthlyLimitPaise: limit(300000) },
  ];
  if (wantsLeaks) {
    categories.push({ name: "Subscriptions", kind: "expense", monthlyLimitPaise: limit(150000) });
  }

  const items: SpinePlanItem[] = [
    { kind: "task", title: "Log today's spends", targetValue: null, targetUnit: null, linkHabitName: null, linkSkillName: null },
  ];

  return {
    domain: "money",
    headerLine: headerLine(answers, "a simple money map."),
    categories,
    items,
  };
}

function deriveSkillsSpine(answers: CoreAnswers): SkillsSpine {
  const name = (answers.goals.skillName ?? "").trim();
  const sessionMinutes = clamp(answers.timeBudgetMinutes, 10, 90);
  // A month of daily sessions as a first cumulative target.
  const targetMinutes = sessionMinutes * 20;

  const items: SpinePlanItem[] = [
    {
      kind: "target",
      title: `Practise ${name} for ${sessionMinutes} min`,
      targetValue: sessionMinutes,
      targetUnit: "minutes",
      linkHabitName: null,
      linkSkillName: name,
    },
  ];

  return {
    domain: "skills",
    headerLine: headerLine(answers, `a path for ${name}.`),
    skill: { name, targetMinutes },
    milestones: ["Fundamentals", "First real project", "Teach it back"],
    items,
  };
}

/** Build the answer-derived spine for one domain. Deterministic given the answers. */
export function deriveSpine(domain: SpineDomain, answers: CoreAnswers): DomainSpine {
  switch (domain) {
    case "health":
      return deriveHealthSpine(answers);
    case "money":
      return deriveMoneySpine(answers);
    case "habits":
      return deriveHabitsSpine(answers);
    case "skills":
      return deriveSkillsSpine(answers);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. The prompt envelope — locked so the fake and the prompt cannot drift (D-E).
 *
 * `generateSpine` embeds the answers as a fenced JSON envelope; `FakeLlmGateway`
 * reads it back and runs `deriveSpine`, so the keyless spine genuinely varies with
 * the answers. A round-trip unit test pins the format.
 * ────────────────────────────────────────────────────────────────────────── */

const SPINE_ENVELOPE = /<<<onboarding-spine\n([\s\S]*?)\n>>>/;

export function buildSpinePrompt(domain: SpineDomain, answers: CoreAnswers): string {
  return (
    `Draft the ${domain} onboarding spine from the user's answers.\n` +
    `<<<onboarding-spine\n${JSON.stringify({ domain, answers })}\n>>>`
  );
}

/** Read `{ domain, answers }` back out of a spine prompt; `null` if malformed. */
export function readSpineEnvelope(prompt: string): { domain: SpineDomain; answers: unknown } | null {
  const match = prompt.match(SPINE_ENVELOPE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { domain?: unknown; answers?: unknown };
    const domain = spineDomainEnum.safeParse(parsed.domain);
    if (!domain.success || typeof parsed.answers !== "object" || parsed.answers === null) return null;
    return { domain: domain.data, answers: parsed.answers };
  } catch {
    return null;
  }
}
