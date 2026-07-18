/**
 * core/onboarding/detail.ts — SAR-012 Pass 3 (Phase E DETAIL + Phase F theme persistence).
 *
 * Framework-clean (zod + core/contracts ports + the drizzle-free `@/data/schema/contract`
 * DTO enums only, invariant #9): no Next/React/provider imports, so the detail route and the
 * tests both reuse it. `applyOnboardingDetail` runs AFTER the D-accept — the profile already
 * exists and is `complete`, and the five DETAIL `profile_gaps` were CREATED at accept
 * (accept.ts D-F g). This service only ANSWERS/RESOLVES a gap; it NEVER creates one. Skipping
 * a section simply never calls here, so its gap stays `open` for the SAR-014 daily-brief
 * backfill (consumption is out of scope — this only resolves).
 *
 * Nothing estimated writes unconfirmed (invariant #1): every value here is an explicit user
 * input (a picked chip, a slider, a typed amount). Integer units only (invariant #2): screen
 * time is `int` minutes, money is `int` PAISE — a float dies at this zod boundary, and the E5
 * `recurring_rules` seeds are integer paise. Typed writes only (invariant #6): the profile
 * columns patch through the scoped repo; E5 seeds go into the typed `recurring_rules` table.
 */
import { z } from "zod";

import type { UserScopedRepositories } from "@/core/contracts";
import { type ProfileUpdate, themeEnum, themeModeEnum } from "@/data/schema/contract";

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Per-section answer shapes (chip enums for integrity; all-integer quantities).
 * ────────────────────────────────────────────────────────────────────────── */

/** E1 diet + how food is sourced (§7). */
export const foodDietEnum = z.enum(["veg", "egg", "non_veg", "mixed"]);
export const foodCookingEnum = z.enum(["cook", "order", "mess"]);
/** E3 attention pattern (§7). */
export const focusPreferenceEnum = z.enum(["deep", "depends", "distractible"]);
/** E4 field of work (§7); `other` carries the free-text `fieldOther`. */
export const careerFieldEnum = z.enum(["swe", "student", "design", "business", "other"]);
/** E4 current level for the B5-named skill (§7). */
export const skillLevelEnum = z.enum(["new", "some", "solid"]);

export const detailFoodSchema = z.object({
  section: z.literal("food"),
  diet: foodDietEnum,
  cooking: foodCookingEnum,
});

export const detailScreenSchema = z.object({
  section: z.literal("screen"),
  // Slider 1–10h+, stored as integer minutes (invariant #2). Bounded to a full day for sanity.
  screenTimeMinutes: z.number().int().min(0).max(1440),
});

export const detailFocusSchema = z.object({
  section: z.literal("focus"),
  focus: focusPreferenceEnum,
});

export const detailCareerSchema = z.object({
  section: z.literal("career"),
  field: careerFieldEnum,
  fieldOther: z.string().trim().max(80).nullable(),
  skillLevel: skillLevelEnum.nullable(),
});

const billSchema = z.object({
  label: z.string().trim().min(1).max(80),
  // Integer PAISE only — the rupee→paise conversion happens at the input boundary.
  amountPaise: z.number().int().nonnegative(),
});

export const detailMoneySchema = z.object({
  section: z.literal("money"),
  // Optional monthly income, stored as integer PAISE (invariant #2).
  monthlyIncomePaise: z.number().int().nonnegative().nullable(),
  bills: z.array(billSchema).max(20),
});

/** Phase F (§8) — persists the picked theme; `themeMode` is already resolved to a concrete
 *  light/dark by the client (the enum has no `system`; localStorage keeps that nuance). */
export const detailThemeSchema = z.object({
  section: z.literal("theme"),
  theme: themeEnum,
  themeMode: themeModeEnum,
});

export const onboardingDetailInputSchema = z.discriminatedUnion("section", [
  detailFoodSchema,
  detailScreenSchema,
  detailFocusSchema,
  detailCareerSchema,
  detailMoneySchema,
  detailThemeSchema,
]);
export type OnboardingDetailInput = z.infer<typeof onboardingDetailInputSchema>;
export type OnboardingDetailSection = OnboardingDetailInput["section"];

/**
 * The gap each E-section resolves. These strings MUST match accept.ts's `DETAIL_GAPS`
 * gapKeys exactly (`detail-food` … `detail-money`) — a mismatch would resolve nothing and
 * throw no error. `theme` has no gap. This map is the single source; a divergence is caught
 * by the round-trip assertion in the test.
 */
export const DETAIL_GAP_KEY = {
  food: "detail-food",
  screen: "detail-screen-time",
  focus: "detail-focus",
  career: "detail-career",
  money: "detail-money",
} as const satisfies Record<Exclude<OnboardingDetailSection, "theme">, string>;

/** `onboardingStep` markers (D-B): E answers land the flow past CORE (6); theme is later. */
const SECTION_STEP: Record<OnboardingDetailSection, number> = {
  food: 7,
  screen: 7,
  focus: 7,
  career: 7,
  money: 7,
  theme: 8,
};

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Column encoders (the profile carries one text column per section; the SAR-014
 *    consumer owns parsing — nothing in Pass 3 reads these back).
 * ────────────────────────────────────────────────────────────────────────── */

/** `foodPattern` as `<diet>/<cooking>` (e.g. `non_veg/order`). */
function encodeFood(diet: z.infer<typeof foodDietEnum>, cooking: z.infer<typeof foodCookingEnum>): string {
  return `${diet}/${cooking}`;
}

/** `careerGoal` as the field (free text for `other`), with the skill level appended when given. */
function encodeCareer(
  field: z.infer<typeof careerFieldEnum>,
  fieldOther: string | null,
  skillLevel: z.infer<typeof skillLevelEnum> | null,
): string {
  const base = field === "other" ? (fieldOther?.trim() || "other") : field;
  return skillLevel ? `${base} · ${skillLevel}` : base;
}

/** First of the next calendar month (YYYY-MM-DD) — a believable `nextPostDate` for a seed. */
function firstOfNextMonth(nowIso: string): string {
  const now = new Date(nowIso);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 1 : month + 2; // 1-based month number
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. The service.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Module-level single-flight — the SAME primitive `core/capture/commit.ts` and
 * `core/onboarding/accept.ts` use, deliberately HOISTED to module scope. Those live inside a
 * per-request service closure; `applyOnboardingDetail` is a bare function, and every request
 * mints a FRESH scope (session → `forUser`), so a per-instance `tail` would serialise nothing
 * across the two overlapping `POST /api/onboarding/detail` requests this must guard. At module
 * scope the lock forces request B's work to not START until request A's transaction has
 * committed — so B's in-transaction `alreadyAnswered` re-read is guaranteed to see `answered`
 * and skip the non-idempotent E5 `recurring_rules` seed (which no unique constraint protects).
 * Belt-and-suspenders over the existing in-txn guard, not a replacement; it never blocks, and
 * a global tail is fine at onboarding frequency (a per-user map buys nothing but a leak).
 */
let detailTail: Promise<unknown> = Promise.resolve();
function withDetailLock<T>(work: () => Promise<T>): Promise<T> {
  const run = detailTail.then(work, work);
  detailTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export interface OnboardingDetailResult {
  section: OnboardingDetailSection;
  /** True when the section's gap existed and is now `answered` (or already was). */
  gapResolved: boolean;
  /** E5 only — the number of `recurring_rules` seeded (income + fixed bills). */
  recurringRulesCreated: number;
}

/** E5 — seed the income credit rule (+ an income category if missing) and each fixed-bill
 *  debit rule. Integer PAISE throughout; a monthly cadence with a next-month post date. */
async function seedMoneyRules(
  input: z.infer<typeof detailMoneySchema>,
  repos: UserScopedRepositories,
  nowIso: string,
): Promise<number> {
  const nextPostDate = firstOfNextMonth(nowIso);
  let created = 0;

  if (input.monthlyIncomePaise !== null && input.monthlyIncomePaise > 0) {
    const categories = await repos.money.categories.list({});
    let incomeCategory =
      categories.find((category) => category.kind === "income" && category.name.toLowerCase() === "income") ?? null;
    if (!incomeCategory) {
      incomeCategory = await repos.money.categories.create({
        name: "Income",
        kind: "income",
        colorKey: null,
        isSystem: false,
      });
    }
    await repos.money.recurringRules.create({
      direction: "credit",
      amountPaise: input.monthlyIncomePaise,
      categoryId: incomeCategory.id,
      merchant: "Monthly income",
      cadence: "monthly",
      nextPostDate,
      isPaused: false,
    });
    created += 1;
  }

  for (const bill of input.bills) {
    await repos.money.recurringRules.create({
      direction: "debit",
      amountPaise: bill.amountPaise,
      categoryId: null,
      merchant: bill.label,
      cadence: "monthly",
      nextPostDate,
      isPaused: false,
    });
    created += 1;
  }

  return created;
}

/**
 * Apply one DETAIL section (or the theme pick): re-validate server-side (integers/paise
 * re-enforced), patch the owning profile column(s), seed E5 money rules, and mark the
 * section's gap `answered`. Replay-safe: a section whose gap is already `answered` re-patches
 * the (idempotent) profile column but does NOT re-create the non-idempotent E5 rules.
 */
export async function applyOnboardingDetail(
  rawInput: OnboardingDetailInput,
  repos: UserScopedRepositories,
  now: () => string = () => new Date().toISOString(),
): Promise<OnboardingDetailResult> {
  // Server-side re-validation (integers/paise re-enforced) BEFORE the lock — a bad payload
  // fails fast without ever queueing behind an in-flight apply.
  const input = onboardingDetailInputSchema.parse(rawInput);

  // Single-flight the whole apply so a concurrent E5 double-submit cannot double-seed the
  // recurring rules (see `withDetailLock`): the second apply runs only after the first commits,
  // so its in-transaction `alreadyAnswered` re-read sees `answered` and skips the seed.
  return withDetailLock(async () => {
    const nowIso = now();

    const profile = (await repos.profile.profiles.list({}))[0] ?? null;
    if (!profile) {
      // Post-accept invariant: the profile exists. A missing one means the caller is out of
      // order — fail loud rather than silently create a gap or a half-onboarded account.
      throw new Error("onboarding detail requires a completed profile");
    }

    let gapResolved = false;
    let recurringRulesCreated = 0;

    await repos.transaction(async () => {
      // Idempotent replay guard: if this section's gap is already answered, the E5 create
      // (the only non-idempotent write) is skipped so a double-submit never doubles the rules.
      const gapKey = input.section === "theme" ? null : DETAIL_GAP_KEY[input.section];
      const gap = gapKey ? (await repos.profile.gaps.list({ gapKey }))[0] ?? null : null;
      const alreadyAnswered = gap?.status === "answered";

      // Profile column patch (E1–E4 + theme). E5 has no profile column — its data is the rules.
      const patch: ProfileUpdate = { onboardingStep: Math.max(profile.onboardingStep, SECTION_STEP[input.section]) };
      switch (input.section) {
        case "food":
          patch.foodPattern = encodeFood(input.diet, input.cooking);
          break;
        case "screen":
          patch.screenTimeMinutes = input.screenTimeMinutes;
          break;
        case "focus":
          patch.focusPreference = input.focus;
          break;
        case "career":
          patch.careerGoal = encodeCareer(input.field, input.fieldOther, input.skillLevel);
          break;
        case "theme":
          patch.theme = input.theme;
          patch.themeMode = input.themeMode;
          break;
        case "money":
          break;
      }
      await repos.profile.profiles.update(profile.userId, patch);

      if (input.section === "money" && !alreadyAnswered) {
        recurringRulesCreated = await seedMoneyRules(input, repos, nowIso);
      }

      // Resolve the gap — never create it (Pass 3 answers, accept enqueued). No-op if absent.
      if (gap) {
        if (!alreadyAnswered) {
          await repos.profile.gaps.update(gap.id, { status: "answered", answeredAt: nowIso });
        }
        gapResolved = true;
      }
    });

    return { section: input.section, gapResolved, recurringRulesCreated };
  });
}
