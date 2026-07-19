/**
 * core/onboarding/contract.ts — SAR-012 Pass 1 (D-A/D-D).
 *
 * The framework-clean answer contract for the CORE onboarding walk (Phase B),
 * the versioned local-draft shape, and the per-question voice-fill field schemas.
 * Zod + core/schema DTO enums only — no Next/React/provider imports (invariant #9),
 * so Pass 2's accept validator and the fake gateway can both reuse it.
 *
 * Integer units only (invariant #2): heightCm / weightGrams / wake+sleep minutes /
 * timeBudgetMinutes are ints; the imperial toggle converts at the input boundary via
 * the helpers below and always STORES metric ints. No float ever reaches the draft.
 */
import { z } from "zod";

import { unitSystemEnum } from "@/data/schema/contract";

/* ────────────────────────────────────────────────────────────────────────────
 * 1. The CORE screens (Phase A + B) and their ordering.
 * ────────────────────────────────────────────────────────────────────────── */

/** The Pass-1 screen sequence. `welcome` is Phase A; the rest are the six CORE
 *  questions the `--energy` hairline fills across (welcome does not count). */
export const onboardingScreenEnum = z.enum([
  "welcome",
  "name",
  "dob",
  "body",
  "day",
  "goals",
  "timeBudget",
]);
export type OnboardingScreen = z.infer<typeof onboardingScreenEnum>;

/** The six CORE question screens, in order — the hairline denominator. */
export const CORE_SCREENS = ["name", "dob", "body", "day", "goals", "timeBudget"] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Answer value shapes (all-integer; enums for chip integrity).
 * ────────────────────────────────────────────────────────────────────────── */

/** B4 "what does your day look like?" — feeds Habits cadence + plan timing (Pass 2
 *  deriveSpine). NOT a profile column: it lives only in the draft/answers. */
export const dayShapeEnum = z.enum(["student", "nine_to_five", "shift", "founder", "at_home"]);
export type DayShape = z.infer<typeof dayShapeEnum>;

export const DAY_SHAPES = [
  { id: "student", label: "student" },
  { id: "nine_to_five", label: "9–5" },
  { id: "shift", label: "shift work" },
  { id: "founder", label: "founder/freelance" },
  { id: "at_home", label: "at home" },
] as const satisfies ReadonlyArray<{ id: DayShape; label: string }>;

/** B5 goal chips, one group per domain (Skills is the free-text "+ name one"). */
export const healthGoalEnum = z.enum(["eat_better", "gym", "weight"]);
export const moneyGoalEnum = z.enum(["track_spends", "budget", "stop_leaks"]);
export const habitsGoalEnum = z.enum(["wake_early", "routine", "focus"]);

export const GOAL_GROUPS = [
  {
    domain: "health",
    label: "Health",
    options: [
      { id: "eat_better", label: "eat better" },
      { id: "gym", label: "gym" },
      { id: "weight", label: "lose/gain" },
    ],
  },
  {
    domain: "money",
    label: "Money",
    options: [
      { id: "track_spends", label: "track spends" },
      { id: "budget", label: "budget" },
      { id: "stop_leaks", label: "stop leaks" },
    ],
  },
  {
    domain: "habits",
    label: "Habits",
    options: [
      { id: "wake_early", label: "wake early" },
      { id: "routine", label: "routine" },
      { id: "focus", label: "focus" },
    ],
  },
] as const;

export const goalsSchema = z.object({
  health: z.array(healthGoalEnum),
  money: z.array(moneyGoalEnum),
  habits: z.array(habitsGoalEnum),
  /** The named skill (B5 "+ name one"); non-empty ⇒ the Skills domain is selected. */
  skillName: z.string().nullable(),
});
export type Goals = z.infer<typeof goalsSchema>;

/** The empty goals value the B5 surface initialises with. */
export const EMPTY_GOALS: Goals = { health: [], money: [], habits: [], skillName: null };

/** B5 requires ≥1 domain: any goal chip in any domain, OR a named skill. */
export function hasAtLeastOneDomain(goals: Goals): boolean {
  return (
    goals.health.length > 0 ||
    goals.money.length > 0 ||
    goals.habits.length > 0 ||
    (goals.skillName !== null && goals.skillName.trim().length > 0)
  );
}

/** B6 time-budget chips → integer minutes/day (plan density). */
export const TIME_BUDGETS = [
  { minutes: 15, label: "15m" },
  { minutes: 30, label: "30m" },
  { minutes: 60, label: "1h" },
  { minutes: 120, label: "2h+" },
] as const;

/** A clock time as integer minutes-from-midnight (0–1439). */
export const clockMinutesSchema = z.number().int().min(0).max(1439);

/* ────────────────────────────────────────────────────────────────────────────
 * 3. The CORE answers contract + the versioned local draft.
 * ────────────────────────────────────────────────────────────────────────── */

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** True iff a regex-shaped `YYYY-MM-DD` string is also a REAL calendar date — rejects
 *  `2999-13-45`, `2021-02-30`, etc. Pure + timezone-independent: it builds the date in
 *  UTC and round-trips the parts, so the check never depends on the host zone. */
function isRealCalendarDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

/** Today's date as a LOCAL `YYYY-MM-DD` string. `new Date()` is the only "now" here —
 *  not a framework import — and ISO date strings compare lexicographically, so a
 *  birthdate strictly greater than this is in the future. Deterministic tests use fixed
 *  past / far-future dates, so this boundary never flakes on the clock. */
function todayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A birthdate: regex-shaped, a real calendar date, and never in the future. The single
 *  source of truth reused by BOTH the CORE answers contract and the DOB voice-fill schema,
 *  so a hallucinated provider fill can't inject an impossible/future date and the Pass-2
 *  accept that reuses this schema stays safe. */
export const birthDateSchema = z
  .string()
  .regex(isoDate)
  .refine(isRealCalendarDate, { message: "birthDate must be a real calendar date" })
  .refine((iso) => iso <= todayIsoLocal(), { message: "birthDate cannot be in the future" });

/** The complete set of CORE answers. Every quantity is an integer stored METRIC. */
const coreAnswersShape = {
  displayName: z.string().min(1),
  birthDate: birthDateSchema,
  heightCm: z.number().int().positive(),
  weightGrams: z.number().int().positive(),
  /** The unit system the user *entered* in (display only); storage is always metric. */
  unitSystem: unitSystemEnum,
  dayShape: dayShapeEnum,
  wakeTimeMinutes: clockMinutesSchema,
  sleepTimeMinutes: clockMinutesSchema,
  goals: goalsSchema,
  timeBudgetMinutes: z.number().int().positive(),
} as const;

export const coreAnswersSchema = z.object(coreAnswersShape);
export type CoreAnswers = z.infer<typeof coreAnswersSchema>;

/** The draft accumulates answers screen-by-screen, so every field is optional. */
export const coreAnswersDraftSchema = z.object(coreAnswersShape).partial();
export type CoreAnswersDraft = z.infer<typeof coreAnswersDraftSchema>;

/** Bump when the draft shape changes; a mismatched persisted draft is discarded. */
export const ONBOARDING_DRAFT_VERSION = 1 as const;

export const onboardingDraftSchema = z.object({
  version: z.literal(ONBOARDING_DRAFT_VERSION),
  screen: onboardingScreenEnum,
  answers: coreAnswersDraftSchema,
});
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

/** Parse a persisted draft; any shape/version mismatch resolves to `null` (start fresh). */
export function readOnboardingDraft(raw: unknown): OnboardingDraft | null {
  const parsed = onboardingDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. Imperial ⇄ metric conversion — at the input boundary, storing metric ints.
 * ────────────────────────────────────────────────────────────────────────── */

const CM_PER_INCH = 2.54;
const GRAMS_PER_LB = 453.59237;

/** ft + in → integer centimetres. */
export function cmFromImperial(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH);
}

/** Integer centimetres → { feet, inches } (both integers, inches 0–11). */
export function imperialFromCm(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

/** Whole kilograms → integer grams. */
export function gramsFromKg(kg: number): number {
  return Math.round(kg * 1000);
}

/** Integer grams → whole kilograms. */
export function kgFromGrams(grams: number): number {
  return Math.round(grams / 1000);
}

/** Whole pounds → integer grams. */
export function gramsFromLb(lb: number): number {
  return Math.round(lb * GRAMS_PER_LB);
}

/** Integer grams → whole pounds. */
export function lbFromGrams(grams: number): number {
  return Math.round(grams / GRAMS_PER_LB);
}

/** Integer minutes-from-midnight → a 24h "HH:MM" label. */
export function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. Voice-fill (D-D): per-question field schemas + the prompt envelope.
 *
 * A spoken B answer posts to /api/onboarding/fill with the QUESTION's key; the
 * fast-tier gateway returns just that question's field(s), shown for confirmation
 * before they enter the draft. On the fake stack the answer is deterministic and
 * keyless — the fake reads the question key back out of the prompt envelope.
 * ────────────────────────────────────────────────────────────────────────── */

export const fillQuestionKeyEnum = z.enum(["name", "dob", "body", "day", "goals", "timeBudget"]);
export type FillQuestionKey = z.infer<typeof fillQuestionKeyEnum>;

export const nameFillSchema = z.object({ displayName: z.string().min(1) });
export const dobFillSchema = z.object({ birthDate: birthDateSchema });
export const bodyFillSchema = z.object({
  heightCm: z.number().int().positive().nullable(),
  weightGrams: z.number().int().positive().nullable(),
});
export const dayFillSchema = z.object({
  dayShape: dayShapeEnum.nullable(),
  wakeTimeMinutes: clockMinutesSchema.nullable(),
  sleepTimeMinutes: clockMinutesSchema.nullable(),
});
export const goalsFillSchema = goalsSchema;
export const timeBudgetFillSchema = z.object({ timeBudgetMinutes: z.number().int().positive() });

/** The field schema each question's voice-fill returns (and the fake validates against). */
export const voiceFillSchemas = {
  name: nameFillSchema,
  dob: dobFillSchema,
  body: bodyFillSchema,
  day: dayFillSchema,
  goals: goalsFillSchema,
  timeBudget: timeBudgetFillSchema,
} as const satisfies Record<FillQuestionKey, z.ZodTypeAny>;

const FILL_ENVELOPE = /<<<onboarding-fill\n([\s\S]*?)\n>>>/;

/** Build the fill prompt with the question key + spoken text in a parseable envelope. */
export function buildFillPrompt(questionKey: FillQuestionKey, text: string): string {
  return (
    `Fill the onboarding answer for question "${questionKey}" from the user's spoken text.\n` +
    `<<<onboarding-fill\n${JSON.stringify({ questionKey, text })}\n>>>`
  );
}

/** Read the `{ questionKey, text }` back out of a fill prompt; `null` if malformed. */
export function readFillEnvelope(prompt: string): { questionKey: FillQuestionKey; text: string } | null {
  const match = prompt.match(FILL_ENVELOPE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { questionKey?: unknown; text?: unknown };
    const key = fillQuestionKeyEnum.safeParse(parsed.questionKey);
    if (!key.success || typeof parsed.text !== "string") return null;
    return { questionKey: key.data, text: parsed.text };
  } catch {
    return null;
  }
}
