/**
 * data/schema/contract.ts — the ORM-free shared source of truth (D-B).
 *
 * Zod + TypeScript ONLY. This module imports no framework, no provider, and no
 * persistence library. It is the single vocabulary that both dialect files
 * (`schema/sqlite.ts`, `schema/postgres.ts`) consume: they translate the
 * declarative table descriptors below into their respective table builders and
 * MUST declare identical names, columns, unique constraints, and indexes.
 *
 * Conventions (ARCHITECTURE §4.1):
 *  - Entity ids are application-generated UUID text; every persistent user row
 *    has non-null `userId`; `profiles.userId` is its own primary key.
 *  - Mutable tables share id/userId/createdAt/updatedAt/nullable deletedAt.
 *    Immutable/audit tables share id/userId/createdAt only.
 *  - Money is non-negative integer `amountPaise` plus explicit `direction`;
 *    quantities are integer millilitres/minutes/grams/weightGrams. No float money.
 *  - Confidence is `confidenceBps` in 0..10000. `localDate` is ISO YYYY-MM-DD;
 *    timestamps are ISO strings (storage layer maps to its native type).
 *  - JSON is limited to the four named support shapes below; it is never a
 *    generic accepted-entry payload.
 *  - Nullable means unknown; zero is a real value.
 *
 * File layout — append §4.3–§4.7 tables in the SAME pattern each:
 *   1. Enum unions (shared vocabulary)
 *   2. Named JSON support shapes (the only allowed JSON)
 *   3. Base column helpers (Zod shapes + column descriptors)
 *   4. Declarative descriptor types
 *   5. Per-domain tables: descriptor + record/create/update/query + DTOs
 *   6. Registry object collecting every descriptor + schema
 */

import { z } from 'zod';

/* ────────────────────────────────────────────────────────────────────────────
 * 1. ENUM UNIONS (shared §4 vocabulary — Zod enum + inferred type)
 * ────────────────────────────────────────────────────────────────────────── */

export const planEnum = z.enum(['free', 'pro']);
export type Plan = z.infer<typeof planEnum>;

export const unitSystemEnum = z.enum(['metric', 'imperial']);
export type UnitSystem = z.infer<typeof unitSystemEnum>;

export const themeEnum = z.enum(['ember', 'bone', 'moss']);
export type Theme = z.infer<typeof themeEnum>;

export const themeModeEnum = z.enum(['light', 'dark']);
export type ThemeMode = z.infer<typeof themeModeEnum>;

export const onboardingStatusEnum = z.enum(['not_started', 'in_progress', 'complete']);
export type OnboardingStatus = z.infer<typeof onboardingStatusEnum>;

/** profile_gaps.status — an onboarding gap awaiting a small-batch answer. */
export const gapStatusEnum = z.enum(['open', 'answered', 'skipped']);
export type GapStatus = z.infer<typeof gapStatusEnum>;

/** transactions.direction — accounting sign (distinct from category kind). */
export const directionEnum = z.enum(['debit', 'credit']);
export type Direction = z.infer<typeof directionEnum>;

/** money_categories.kind — the category's nature. */
export const categoryKindEnum = z.enum(['expense', 'income']);
export type CategoryKind = z.infer<typeof categoryKindEnum>;

export const cadenceEnum = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
export type Cadence = z.infer<typeof cadenceEnum>;

export const habitLogStatusEnum = z.enum(['done', 'partial', 'skipped', 'missed']);
export type HabitLogStatus = z.infer<typeof habitLogStatusEnum>;

export const planItemKindEnum = z.enum(['task', 'target', 'checkin', 'milestone']);
export type PlanItemKind = z.infer<typeof planItemKindEnum>;

export const planItemStatusEnum = z.enum(['pending', 'active', 'done', 'skipped', 'missed']);
export type PlanItemStatus = z.infer<typeof planItemStatusEnum>;

export const completionSourceEnum = z.enum(['manual', 'capture', 'tool', 'rule', 'auto']);
export type CompletionSource = z.infer<typeof completionSourceEnum>;

export const domainEnum = z.enum(['overall', 'health', 'money', 'habits', 'skills']);
export type Domain = z.infer<typeof domainEnum>;

export const coachScopeEnum = z.enum(['capture', 'daily', 'weekly']);
export type CoachScope = z.infer<typeof coachScopeEnum>;

export const adaptationStatusEnum = z.enum(['proposed', 'kept', 'reverted']);
export type AdaptationStatus = z.infer<typeof adaptationStatusEnum>;

export const commitKindEnum = z.enum(['capture', 'tap', 'tool', 'edit', 'delete']);
export type CommitKind = z.infer<typeof commitKindEnum>;

export const commitStatusEnum = z.enum(['committed', 'undone', 'superseded']);
export type CommitStatus = z.infer<typeof commitStatusEnum>;

export const operationEnum = z.enum(['create', 'update', 'delete']);
export type Operation = z.infer<typeof operationEnum>;

export const billingProviderEnum = z.enum(['razorpay']);
export type BillingProvider = z.infer<typeof billingProviderEnum>;

export const currencyEnum = z.enum(['INR']);
export type Currency = z.infer<typeof currencyEnum>;

export const waitlistSourceEnum = z.enum(['pricing']);
export type WaitlistSource = z.infer<typeof waitlistSourceEnum>;

/* ────────────────────────────────────────────────────────────────────────────
 * 2. NAMED JSON SUPPORT SHAPES (the ONLY JSON shapes permitted in the schema)
 * ────────────────────────────────────────────────────────────────────────── */

/** day_one_snapshots.statsJson — a domain's stats frozen at a point in time. */
export const domainStatsSnapshot = z.object({
  domain: domainEnum,
  asOfLocalDate: z.string(),
  xp: z.number().int(),
  level: z.number().int(),
  streak: z.number().int(),
  bestStreak: z.number().int(),
  cumulativeMinutes: z.number().int(),
  metrics: z.array(
    z.object({
      key: z.string(),
      valueInt: z.number().int(),
      unit: z.string().nullable(),
    }),
  ),
});
export type DomainStatsSnapshot = z.infer<typeof domainStatsSnapshot>;

/** plan_items.ruleJson — declarative rule that auto-completes a plan item. */
export const planRule = z.object({
  sourceDomain: domainEnum,
  sourceKind: z.string(),
  aggregateField: z.string(),
  comparator: z.enum(['gte', 'lte', 'eq']),
  thresholdValue: z.number().int(),
  unit: z.string().nullable(),
  windowDays: z.number().int(),
});
export type PlanRule = z.infer<typeof planRule>;

/** coach_notes.evidenceJson — the grounded entries a coach note was built from. */
export const coachEvidence = z.object({
  generatedForLocalDate: z.string(),
  items: z.array(
    z.object({
      domain: domainEnum,
      entryKind: z.string(),
      entryId: z.string().nullable(),
      label: z.string(),
      valueInt: z.number().int().nullable(),
      unit: z.string().nullable(),
    }),
  ),
});
export type CoachEvidence = z.infer<typeof coachEvidence>;

/** commit_rows before/after — a typed snapshot of one row for glass-box undo. */
export const commitRowSnapshot = z.object({
  entryKind: z.string(),
  entryId: z.string(),
  columns: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});
export type CommitRowSnapshot = z.infer<typeof commitRowSnapshot>;

/* ────────────────────────────────────────────────────────────────────────────
 * 3. BASE COLUMN HELPERS (Zod shapes + column descriptors)
 *    ids are UUID text; timestamps are ISO strings.
 * ────────────────────────────────────────────────────────────────────────── */

/** Full-row Zod shape for mutable tables. */
const mutableBaseShape = {
  id: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
};

/** Full-row Zod shape for immutable/audit tables. */
const immutableBaseShape = {
  id: z.string(),
  userId: z.string(),
  createdAt: z.string(),
};

/**
 * Create-input base shapes. Server/repo assigns timestamps and (if absent) the
 * id; the application may supply a pre-generated UUID id for idempotency.
 */
const mutableCreateBaseShape = {
  id: z.string().optional(),
  userId: z.string(),
};
const immutableCreateBaseShape = {
  id: z.string().optional(),
  userId: z.string(),
};

/** Column descriptors mirroring the base Zod shapes above. */
const mutableBaseColumns: ColumnDescriptor[] = [
  { name: 'id', type: 'uuid', notNull: true },
  { name: 'userId', type: 'uuid', notNull: true },
  { name: 'createdAt', type: 'timestamp', notNull: true },
  { name: 'updatedAt', type: 'timestamp', notNull: true },
  { name: 'deletedAt', type: 'timestamp', notNull: false },
];
const immutableBaseColumns: ColumnDescriptor[] = [
  { name: 'id', type: 'uuid', notNull: true },
  { name: 'userId', type: 'uuid', notNull: true },
  { name: 'createdAt', type: 'timestamp', notNull: true },
];

/* ────────────────────────────────────────────────────────────────────────────
 * 4. DECLARATIVE DESCRIPTOR TYPES (consumed by the dialect files)
 * ────────────────────────────────────────────────────────────────────────── */

export type ColumnType =
  | 'uuid'
  | 'text'
  | 'integer'
  | 'boolean'
  | 'timestamp'
  | 'date'
  | 'json';

export interface ColumnDescriptor {
  name: string;
  type: ColumnType;
  notNull: boolean;
  /** Enum-union name when a text column is constrained to a fixed set. */
  enum?: string;
  /** Named support-shape when a json column carries a structured value. */
  jsonShape?: string;
  /** Referenced table name for future foreign-key wiring. */
  references?: string;
}

export interface TableDescriptor {
  name: string;
  columns: ColumnDescriptor[];
  /** Column names forming the primary key. */
  primaryKey: string[];
  /** Composite unique constraints, each a list of column names. */
  unique: string[][];
  /** Non-unique indexes, each a list of column names. */
  indexes: string[][];
}

/** One table's declarative descriptor plus its Zod contract set. */
export interface TableContract {
  descriptor: TableDescriptor;
  record: z.ZodTypeAny;
  create: z.ZodTypeAny;
  /** Omitted for immutable/audit tables. */
  update?: z.ZodTypeAny;
  query: z.ZodTypeAny;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. §4.2 PROFILE AND ONBOARDING TABLES
 * ────────────────────────────────────────────────────────────────────────── */

/* ── profiles ─────────────────────────────────────────────────────────────
 * Per-user singleton keyed by userId (its own primary key — no separate id,
 * no soft-delete). "timestamps" = createdAt + updatedAt.
 */
const profilesBusinessShape = {
  displayName: z.string().nullable(),
  birthDate: z.string().nullable(),
  heightCm: z.number().int().nullable(),
  weightGrams: z.number().int().nullable(),
  unitSystem: unitSystemEnum,
  theme: themeEnum,
  themeMode: themeModeEnum,
  wakeTimeMinutes: z.number().int().nullable(),
  sleepTimeMinutes: z.number().int().nullable(),
  timeBudgetMinutes: z.number().int().nullable(),
  foodPattern: z.string().nullable(),
  screenTimeMinutes: z.number().int().nullable(),
  focusPreference: z.string().nullable(),
  careerGoal: z.string().nullable(),
  moneyGoal: z.string().nullable(),
  plan: planEnum,
  onboardingStatus: onboardingStatusEnum,
  onboardingStep: z.number().int(),
  seedVersion: z.number().int().nullable(),
};

export const profilesRecord = z.object({
  userId: z.string(),
  ...profilesBusinessShape,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const profilesCreate = z.object({
  userId: z.string(),
  ...profilesBusinessShape,
});
export const profilesUpdate = z.object(profilesBusinessShape).partial();
export const profilesQuery = z.object({
  userId: z.string(),
  onboardingStatus: onboardingStatusEnum.optional(),
  plan: planEnum.optional(),
});

export type ProfileRecord = z.infer<typeof profilesRecord>;
export type ProfileCreate = z.infer<typeof profilesCreate>;
export type ProfileUpdate = z.infer<typeof profilesUpdate>;
export type ProfileQuery = z.infer<typeof profilesQuery>;

const profilesTable: TableDescriptor = {
  name: 'profiles',
  columns: [
    { name: 'userId', type: 'uuid', notNull: true },
    { name: 'displayName', type: 'text', notNull: false },
    { name: 'birthDate', type: 'date', notNull: false },
    { name: 'heightCm', type: 'integer', notNull: false },
    { name: 'weightGrams', type: 'integer', notNull: false },
    { name: 'unitSystem', type: 'text', notNull: true, enum: 'unitSystem' },
    { name: 'theme', type: 'text', notNull: true, enum: 'theme' },
    { name: 'themeMode', type: 'text', notNull: true, enum: 'themeMode' },
    { name: 'wakeTimeMinutes', type: 'integer', notNull: false },
    { name: 'sleepTimeMinutes', type: 'integer', notNull: false },
    { name: 'timeBudgetMinutes', type: 'integer', notNull: false },
    { name: 'foodPattern', type: 'text', notNull: false },
    { name: 'screenTimeMinutes', type: 'integer', notNull: false },
    { name: 'focusPreference', type: 'text', notNull: false },
    { name: 'careerGoal', type: 'text', notNull: false },
    { name: 'moneyGoal', type: 'text', notNull: false },
    { name: 'plan', type: 'text', notNull: true, enum: 'plan' },
    { name: 'onboardingStatus', type: 'text', notNull: true, enum: 'onboardingStatus' },
    { name: 'onboardingStep', type: 'integer', notNull: true },
    { name: 'seedVersion', type: 'integer', notNull: false },
    { name: 'createdAt', type: 'timestamp', notNull: true },
    { name: 'updatedAt', type: 'timestamp', notNull: true },
  ],
  primaryKey: ['userId'],
  unique: [],
  indexes: [['onboardingStatus', 'updatedAt']],
};

/* ── profile_gaps ─────────────────────────────────────────────────────────
 * Outstanding onboarding gaps surfaced as small-batch questions.
 */
const profileGapsBusinessShape = {
  gapKey: z.string(),
  prompt: z.string(),
  optionsJson: z.array(z.string()).nullable(),
  status: gapStatusEnum,
  answeredAt: z.string().nullable(),
};

export const profileGapsRecord = z.object({
  ...mutableBaseShape,
  ...profileGapsBusinessShape,
});
export const profileGapsCreate = z.object({
  ...mutableCreateBaseShape,
  ...profileGapsBusinessShape,
});
export const profileGapsUpdate = z.object(profileGapsBusinessShape).partial();
export const profileGapsQuery = z.object({
  userId: z.string(),
  status: gapStatusEnum.optional(),
  gapKey: z.string().optional(),
});

export type ProfileGapRecord = z.infer<typeof profileGapsRecord>;
export type ProfileGapCreate = z.infer<typeof profileGapsCreate>;
export type ProfileGapUpdate = z.infer<typeof profileGapsUpdate>;
export type ProfileGapQuery = z.infer<typeof profileGapsQuery>;

const profileGapsTable: TableDescriptor = {
  name: 'profile_gaps',
  columns: [
    ...mutableBaseColumns,
    { name: 'gapKey', type: 'text', notNull: true },
    { name: 'prompt', type: 'text', notNull: true },
    { name: 'optionsJson', type: 'json', notNull: false },
    { name: 'status', type: 'text', notNull: true, enum: 'gapStatus' },
    { name: 'answeredAt', type: 'timestamp', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'gapKey']],
  indexes: [['userId', 'status']],
};

/* ── seed_runs ────────────────────────────────────────────────────────────
 * Immutable ledger of applied seeds; drives idempotent D-033 cloning.
 */
const seedRunsBusinessShape = {
  seedKey: z.string(),
  seedVersion: z.number().int(),
  completedAt: z.string().nullable(),
};

export const seedRunsRecord = z.object({
  ...immutableBaseShape,
  ...seedRunsBusinessShape,
});
export const seedRunsCreate = z.object({
  ...immutableCreateBaseShape,
  ...seedRunsBusinessShape,
});
export const seedRunsQuery = z.object({
  userId: z.string(),
  seedKey: z.string().optional(),
});

export type SeedRunRecord = z.infer<typeof seedRunsRecord>;
export type SeedRunCreate = z.infer<typeof seedRunsCreate>;
export type SeedRunQuery = z.infer<typeof seedRunsQuery>;

const seedRunsTable: TableDescriptor = {
  name: 'seed_runs',
  columns: [
    ...immutableBaseColumns,
    { name: 'seedKey', type: 'text', notNull: true },
    { name: 'seedVersion', type: 'integer', notNull: true },
    { name: 'completedAt', type: 'timestamp', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'seedKey']],
  indexes: [],
};

/* ────────────────────────────────────────────────────────────────────────────
 * §4.3 MONEY TABLES
 *   Money is non-negative integer `amountPaise`/`limitPaise` plus explicit
 *   `direction`. No monetary float exists anywhere.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── money_categories ─────────────────────────────────────────────────────
 * User-scoped spending/earning categories (system + custom).
 */
const moneyCategoriesBusinessShape = {
  name: z.string(),
  kind: categoryKindEnum,
  colorKey: z.string().nullable(),
  isSystem: z.boolean(),
};

export const moneyCategoriesRecord = z.object({
  ...mutableBaseShape,
  ...moneyCategoriesBusinessShape,
});
export const moneyCategoriesCreate = z.object({
  ...mutableCreateBaseShape,
  ...moneyCategoriesBusinessShape,
});
export const moneyCategoriesUpdate = z.object(moneyCategoriesBusinessShape).partial();
export const moneyCategoriesQuery = z.object({
  userId: z.string(),
  kind: categoryKindEnum.optional(),
  isSystem: z.boolean().optional(),
});

export type MoneyCategoryRecord = z.infer<typeof moneyCategoriesRecord>;
export type MoneyCategoryCreate = z.infer<typeof moneyCategoriesCreate>;
export type MoneyCategoryUpdate = z.infer<typeof moneyCategoriesUpdate>;
export type MoneyCategoryQuery = z.infer<typeof moneyCategoriesQuery>;

const moneyCategoriesTable: TableDescriptor = {
  name: 'money_categories',
  columns: [
    ...mutableBaseColumns,
    { name: 'name', type: 'text', notNull: true },
    { name: 'kind', type: 'text', notNull: true, enum: 'categoryKind' },
    { name: 'colorKey', type: 'text', notNull: false },
    { name: 'isSystem', type: 'boolean', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'name', 'kind']],
  indexes: [],
};

/* ── transactions ─────────────────────────────────────────────────────────
 * A single money movement. `direction` is the accounting sign; `estimated`
 * routes it to a swipe card when the value was not explicit.
 */
const transactionsBusinessShape = {
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  direction: directionEnum,
  amountPaise: z.number().int().nonnegative(),
  categoryId: z.string().nullable(),
  merchant: z.string().nullable(),
  note: z.string().nullable(),
  source: z.string(),
  confidenceBps: z.number().int().min(0).max(10000),
  estimated: z.boolean(),
  evidenceId: z.string().nullable(),
  recurringRuleId: z.string().nullable(),
};

export const transactionsRecord = z.object({
  ...mutableBaseShape,
  ...transactionsBusinessShape,
});
export const transactionsCreate = z.object({
  ...mutableCreateBaseShape,
  ...transactionsBusinessShape,
});
export const transactionsUpdate = z.object(transactionsBusinessShape).partial();
export const transactionsQuery = z.object({
  userId: z.string(),
  localDate: z.string().optional(),
  categoryId: z.string().optional(),
  direction: directionEnum.optional(),
  estimated: z.boolean().optional(),
  recurringRuleId: z.string().optional(),
});

export type TransactionRecord = z.infer<typeof transactionsRecord>;
export type TransactionCreate = z.infer<typeof transactionsCreate>;
export type TransactionUpdate = z.infer<typeof transactionsUpdate>;
export type TransactionQuery = z.infer<typeof transactionsQuery>;

const transactionsTable: TableDescriptor = {
  name: 'transactions',
  columns: [
    ...mutableBaseColumns,
    { name: 'occurredAt', type: 'timestamp', notNull: true },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'timezone', type: 'text', notNull: true },
    { name: 'direction', type: 'text', notNull: true, enum: 'direction' },
    { name: 'amountPaise', type: 'integer', notNull: true },
    { name: 'categoryId', type: 'uuid', notNull: false, references: 'money_categories' },
    { name: 'merchant', type: 'text', notNull: false },
    { name: 'note', type: 'text', notNull: false },
    { name: 'source', type: 'text', notNull: true },
    { name: 'confidenceBps', type: 'integer', notNull: true },
    { name: 'estimated', type: 'boolean', notNull: true },
    { name: 'evidenceId', type: 'uuid', notNull: false, references: 'evidence' },
    { name: 'recurringRuleId', type: 'uuid', notNull: false, references: 'recurring_rules' },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [
    ['userId', 'localDate'],
    ['userId', 'categoryId', 'localDate'],
    ['userId', 'recurringRuleId'],
  ],
};

/* ── recurring_rules ──────────────────────────────────────────────────────
 * Templates that post transactions on a cadence until paused.
 */
const recurringRulesBusinessShape = {
  direction: directionEnum,
  amountPaise: z.number().int().nonnegative(),
  categoryId: z.string().nullable(),
  merchant: z.string().nullable(),
  cadence: cadenceEnum,
  nextPostDate: z.string(),
  isPaused: z.boolean(),
};

export const recurringRulesRecord = z.object({
  ...mutableBaseShape,
  ...recurringRulesBusinessShape,
});
export const recurringRulesCreate = z.object({
  ...mutableCreateBaseShape,
  ...recurringRulesBusinessShape,
});
export const recurringRulesUpdate = z.object(recurringRulesBusinessShape).partial();
export const recurringRulesQuery = z.object({
  userId: z.string(),
  cadence: cadenceEnum.optional(),
  isPaused: z.boolean().optional(),
  nextPostDate: z.string().optional(),
});

export type RecurringRuleRecord = z.infer<typeof recurringRulesRecord>;
export type RecurringRuleCreate = z.infer<typeof recurringRulesCreate>;
export type RecurringRuleUpdate = z.infer<typeof recurringRulesUpdate>;
export type RecurringRuleQuery = z.infer<typeof recurringRulesQuery>;

const recurringRulesTable: TableDescriptor = {
  name: 'recurring_rules',
  columns: [
    ...mutableBaseColumns,
    { name: 'direction', type: 'text', notNull: true, enum: 'direction' },
    { name: 'amountPaise', type: 'integer', notNull: true },
    { name: 'categoryId', type: 'uuid', notNull: false, references: 'money_categories' },
    { name: 'merchant', type: 'text', notNull: false },
    { name: 'cadence', type: 'text', notNull: true, enum: 'cadence' },
    { name: 'nextPostDate', type: 'date', notNull: true },
    { name: 'isPaused', type: 'boolean', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'nextPostDate']],
};

/* ── budgets ──────────────────────────────────────────────────────────────
 * Per-category spend ceiling for a date window.
 */
const budgetsBusinessShape = {
  categoryId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  limitPaise: z.number().int().nonnegative(),
};

export const budgetsRecord = z.object({
  ...mutableBaseShape,
  ...budgetsBusinessShape,
});
export const budgetsCreate = z.object({
  ...mutableCreateBaseShape,
  ...budgetsBusinessShape,
});
export const budgetsUpdate = z.object(budgetsBusinessShape).partial();
export const budgetsQuery = z.object({
  userId: z.string(),
  categoryId: z.string().optional(),
});

export type BudgetRecord = z.infer<typeof budgetsRecord>;
export type BudgetCreate = z.infer<typeof budgetsCreate>;
export type BudgetUpdate = z.infer<typeof budgetsUpdate>;
export type BudgetQuery = z.infer<typeof budgetsQuery>;

const budgetsTable: TableDescriptor = {
  name: 'budgets',
  columns: [
    ...mutableBaseColumns,
    { name: 'categoryId', type: 'uuid', notNull: true, references: 'money_categories' },
    { name: 'periodStart', type: 'date', notNull: true },
    { name: 'periodEnd', type: 'date', notNull: true },
    { name: 'limitPaise', type: 'integer', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'categoryId', 'periodStart', 'periodEnd']],
  indexes: [],
};

/* ────────────────────────────────────────────────────────────────────────────
 * §4.4 HEALTH TABLES
 *   Quantities are integer grams/millilitres/minutes. `estimated` + low
 *   `confidenceBps` route an entry to a swipe card instead of a silent write.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── meals ────────────────────────────────────────────────────────────────
 * One eating occasion; macros are nullable when not yet known.
 */
const mealsBusinessShape = {
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  kcal: z.number().int().nullable(),
  proteinGrams: z.number().int().nullable(),
  carbsGrams: z.number().int().nullable(),
  fatGrams: z.number().int().nullable(),
  source: z.string(),
  confidenceBps: z.number().int().min(0).max(10000),
  estimated: z.boolean(),
  evidenceId: z.string().nullable(),
  note: z.string().nullable(),
};

export const mealsRecord = z.object({
  ...mutableBaseShape,
  ...mealsBusinessShape,
});
export const mealsCreate = z.object({
  ...mutableCreateBaseShape,
  ...mealsBusinessShape,
});
export const mealsUpdate = z.object(mealsBusinessShape).partial();
export const mealsQuery = z.object({
  userId: z.string(),
  localDate: z.string().optional(),
  estimated: z.boolean().optional(),
});

export type MealRecord = z.infer<typeof mealsRecord>;
export type MealCreate = z.infer<typeof mealsCreate>;
export type MealUpdate = z.infer<typeof mealsUpdate>;
export type MealQuery = z.infer<typeof mealsQuery>;

const mealsTable: TableDescriptor = {
  name: 'meals',
  columns: [
    ...mutableBaseColumns,
    { name: 'occurredAt', type: 'timestamp', notNull: true },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'timezone', type: 'text', notNull: true },
    { name: 'kcal', type: 'integer', notNull: false },
    { name: 'proteinGrams', type: 'integer', notNull: false },
    { name: 'carbsGrams', type: 'integer', notNull: false },
    { name: 'fatGrams', type: 'integer', notNull: false },
    { name: 'source', type: 'text', notNull: true },
    { name: 'confidenceBps', type: 'integer', notNull: true },
    { name: 'estimated', type: 'boolean', notNull: true },
    { name: 'evidenceId', type: 'uuid', notNull: false, references: 'evidence' },
    { name: 'note', type: 'text', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'localDate']],
};

/* ── meal_items ───────────────────────────────────────────────────────────
 * Line items within a meal; each belongs to a meal.
 */
const mealItemsBusinessShape = {
  mealId: z.string(),
  name: z.string(),
  quantityGrams: z.number().int().nullable(),
  kcal: z.number().int().nullable(),
  proteinGrams: z.number().int().nullable(),
  carbsGrams: z.number().int().nullable(),
  fatGrams: z.number().int().nullable(),
  estimated: z.boolean(),
  confidenceBps: z.number().int().min(0).max(10000),
};

export const mealItemsRecord = z.object({
  ...mutableBaseShape,
  ...mealItemsBusinessShape,
});
export const mealItemsCreate = z.object({
  ...mutableCreateBaseShape,
  ...mealItemsBusinessShape,
});
export const mealItemsUpdate = z.object(mealItemsBusinessShape).partial();
export const mealItemsQuery = z.object({
  userId: z.string(),
  mealId: z.string().optional(),
});

export type MealItemRecord = z.infer<typeof mealItemsRecord>;
export type MealItemCreate = z.infer<typeof mealItemsCreate>;
export type MealItemUpdate = z.infer<typeof mealItemsUpdate>;
export type MealItemQuery = z.infer<typeof mealItemsQuery>;

const mealItemsTable: TableDescriptor = {
  name: 'meal_items',
  columns: [
    ...mutableBaseColumns,
    { name: 'mealId', type: 'uuid', notNull: true, references: 'meals' },
    { name: 'name', type: 'text', notNull: true },
    { name: 'quantityGrams', type: 'integer', notNull: false },
    { name: 'kcal', type: 'integer', notNull: false },
    { name: 'proteinGrams', type: 'integer', notNull: false },
    { name: 'carbsGrams', type: 'integer', notNull: false },
    { name: 'fatGrams', type: 'integer', notNull: false },
    { name: 'estimated', type: 'boolean', notNull: true },
    { name: 'confidenceBps', type: 'integer', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'mealId']],
};

/* ── water_logs ───────────────────────────────────────────────────────────
 * A single hydration entry in integer millilitres.
 */
const waterLogsBusinessShape = {
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  millilitres: z.number().int(),
  source: z.string(),
  confidenceBps: z.number().int().min(0).max(10000),
  estimated: z.boolean(),
};

export const waterLogsRecord = z.object({
  ...mutableBaseShape,
  ...waterLogsBusinessShape,
});
export const waterLogsCreate = z.object({
  ...mutableCreateBaseShape,
  ...waterLogsBusinessShape,
});
export const waterLogsUpdate = z.object(waterLogsBusinessShape).partial();
export const waterLogsQuery = z.object({
  userId: z.string(),
  localDate: z.string().optional(),
  estimated: z.boolean().optional(),
});

export type WaterLogRecord = z.infer<typeof waterLogsRecord>;
export type WaterLogCreate = z.infer<typeof waterLogsCreate>;
export type WaterLogUpdate = z.infer<typeof waterLogsUpdate>;
export type WaterLogQuery = z.infer<typeof waterLogsQuery>;

const waterLogsTable: TableDescriptor = {
  name: 'water_logs',
  columns: [
    ...mutableBaseColumns,
    { name: 'occurredAt', type: 'timestamp', notNull: true },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'timezone', type: 'text', notNull: true },
    { name: 'millilitres', type: 'integer', notNull: true },
    { name: 'source', type: 'text', notNull: true },
    { name: 'confidenceBps', type: 'integer', notNull: true },
    { name: 'estimated', type: 'boolean', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'localDate']],
};

/* ── workouts ─────────────────────────────────────────────────────────────
 * A training session; duration/burn nullable when not measured.
 */
const workoutsBusinessShape = {
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  durationMinutes: z.number().int().nullable(),
  burnKcal: z.number().int().nullable(),
  source: z.string(),
  confidenceBps: z.number().int().min(0).max(10000),
  estimated: z.boolean(),
  note: z.string().nullable(),
};

export const workoutsRecord = z.object({
  ...mutableBaseShape,
  ...workoutsBusinessShape,
});
export const workoutsCreate = z.object({
  ...mutableCreateBaseShape,
  ...workoutsBusinessShape,
});
export const workoutsUpdate = z.object(workoutsBusinessShape).partial();
export const workoutsQuery = z.object({
  userId: z.string(),
  localDate: z.string().optional(),
  estimated: z.boolean().optional(),
});

export type WorkoutRecord = z.infer<typeof workoutsRecord>;
export type WorkoutCreate = z.infer<typeof workoutsCreate>;
export type WorkoutUpdate = z.infer<typeof workoutsUpdate>;
export type WorkoutQuery = z.infer<typeof workoutsQuery>;

const workoutsTable: TableDescriptor = {
  name: 'workouts',
  columns: [
    ...mutableBaseColumns,
    { name: 'occurredAt', type: 'timestamp', notNull: true },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'timezone', type: 'text', notNull: true },
    { name: 'durationMinutes', type: 'integer', notNull: false },
    { name: 'burnKcal', type: 'integer', notNull: false },
    { name: 'source', type: 'text', notNull: true },
    { name: 'confidenceBps', type: 'integer', notNull: true },
    { name: 'estimated', type: 'boolean', notNull: true },
    { name: 'note', type: 'text', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'localDate']],
};

/* ── workout_exercises ────────────────────────────────────────────────────
 * Ordered exercises within a workout.
 */
const workoutExercisesBusinessShape = {
  workoutId: z.string(),
  name: z.string(),
  sets: z.number().int().nullable(),
  reps: z.number().int().nullable(),
  loadGrams: z.number().int().nullable(),
  sortOrder: z.number().int(),
};

export const workoutExercisesRecord = z.object({
  ...mutableBaseShape,
  ...workoutExercisesBusinessShape,
});
export const workoutExercisesCreate = z.object({
  ...mutableCreateBaseShape,
  ...workoutExercisesBusinessShape,
});
export const workoutExercisesUpdate = z.object(workoutExercisesBusinessShape).partial();
export const workoutExercisesQuery = z.object({
  userId: z.string(),
  workoutId: z.string().optional(),
});

export type WorkoutExerciseRecord = z.infer<typeof workoutExercisesRecord>;
export type WorkoutExerciseCreate = z.infer<typeof workoutExercisesCreate>;
export type WorkoutExerciseUpdate = z.infer<typeof workoutExercisesUpdate>;
export type WorkoutExerciseQuery = z.infer<typeof workoutExercisesQuery>;

const workoutExercisesTable: TableDescriptor = {
  name: 'workout_exercises',
  columns: [
    ...mutableBaseColumns,
    { name: 'workoutId', type: 'uuid', notNull: true, references: 'workouts' },
    { name: 'name', type: 'text', notNull: true },
    { name: 'sets', type: 'integer', notNull: false },
    { name: 'reps', type: 'integer', notNull: false },
    { name: 'loadGrams', type: 'integer', notNull: false },
    { name: 'sortOrder', type: 'integer', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'workoutId', 'sortOrder']],
};

/* ── weigh_ins ────────────────────────────────────────────────────────────
 * A body-weight measurement in integer grams.
 */
const weighInsBusinessShape = {
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  weightGrams: z.number().int(),
  source: z.string(),
  confidenceBps: z.number().int().min(0).max(10000),
  estimated: z.boolean(),
};

export const weighInsRecord = z.object({
  ...mutableBaseShape,
  ...weighInsBusinessShape,
});
export const weighInsCreate = z.object({
  ...mutableCreateBaseShape,
  ...weighInsBusinessShape,
});
export const weighInsUpdate = z.object(weighInsBusinessShape).partial();
export const weighInsQuery = z.object({
  userId: z.string(),
  localDate: z.string().optional(),
  estimated: z.boolean().optional(),
});

export type WeighInRecord = z.infer<typeof weighInsRecord>;
export type WeighInCreate = z.infer<typeof weighInsCreate>;
export type WeighInUpdate = z.infer<typeof weighInsUpdate>;
export type WeighInQuery = z.infer<typeof weighInsQuery>;

const weighInsTable: TableDescriptor = {
  name: 'weigh_ins',
  columns: [
    ...mutableBaseColumns,
    { name: 'occurredAt', type: 'timestamp', notNull: true },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'timezone', type: 'text', notNull: true },
    { name: 'weightGrams', type: 'integer', notNull: true },
    { name: 'source', type: 'text', notNull: true },
    { name: 'confidenceBps', type: 'integer', notNull: true },
    { name: 'estimated', type: 'boolean', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'localDate']],
};

/* ────────────────────────────────────────────────────────────────────────────
 * §4.5 HABITS AND SKILLS TABLES
 *   Targets and session values are integer minutes/counts. Satisfaction rules
 *   let a habit auto-complete from another domain's aggregate.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── habits ───────────────────────────────────────────────────────────────
 * A recurring commitment tracked on a cadence.
 */
const habitsBusinessShape = {
  name: z.string(),
  cadence: cadenceEnum,
  difficulty: z.string(),
  targetValue: z.number().int().nullable(),
  targetUnit: z.string().nullable(),
  isArchived: z.boolean(),
};

export const habitsRecord = z.object({
  ...mutableBaseShape,
  ...habitsBusinessShape,
});
export const habitsCreate = z.object({
  ...mutableCreateBaseShape,
  ...habitsBusinessShape,
});
export const habitsUpdate = z.object(habitsBusinessShape).partial();
export const habitsQuery = z.object({
  userId: z.string(),
  cadence: cadenceEnum.optional(),
  isArchived: z.boolean().optional(),
});

export type HabitRecord = z.infer<typeof habitsRecord>;
export type HabitCreate = z.infer<typeof habitsCreate>;
export type HabitUpdate = z.infer<typeof habitsUpdate>;
export type HabitQuery = z.infer<typeof habitsQuery>;

const habitsTable: TableDescriptor = {
  name: 'habits',
  columns: [
    ...mutableBaseColumns,
    { name: 'name', type: 'text', notNull: true },
    { name: 'cadence', type: 'text', notNull: true, enum: 'cadence' },
    { name: 'difficulty', type: 'text', notNull: true },
    { name: 'targetValue', type: 'integer', notNull: false },
    { name: 'targetUnit', type: 'text', notNull: false },
    { name: 'isArchived', type: 'boolean', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'name']],
  indexes: [],
};

/* ── habit_logs ───────────────────────────────────────────────────────────
 * One dated completion status per habit per day.
 */
const habitLogsBusinessShape = {
  habitId: z.string(),
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  status: habitLogStatusEnum,
  source: z.string(),
  note: z.string().nullable(),
};

export const habitLogsRecord = z.object({
  ...mutableBaseShape,
  ...habitLogsBusinessShape,
});
export const habitLogsCreate = z.object({
  ...mutableCreateBaseShape,
  ...habitLogsBusinessShape,
});
export const habitLogsUpdate = z.object(habitLogsBusinessShape).partial();
export const habitLogsQuery = z.object({
  userId: z.string(),
  habitId: z.string().optional(),
  localDate: z.string().optional(),
  status: habitLogStatusEnum.optional(),
});

export type HabitLogRecord = z.infer<typeof habitLogsRecord>;
export type HabitLogCreate = z.infer<typeof habitLogsCreate>;
export type HabitLogUpdate = z.infer<typeof habitLogsUpdate>;
export type HabitLogQuery = z.infer<typeof habitLogsQuery>;

const habitLogsTable: TableDescriptor = {
  name: 'habit_logs',
  columns: [
    ...mutableBaseColumns,
    { name: 'habitId', type: 'uuid', notNull: true, references: 'habits' },
    { name: 'occurredAt', type: 'timestamp', notNull: true },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'timezone', type: 'text', notNull: true },
    { name: 'status', type: 'text', notNull: true, enum: 'habitLogStatus' },
    { name: 'source', type: 'text', notNull: true },
    { name: 'note', type: 'text', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'habitId', 'localDate']],
  indexes: [['userId', 'localDate']],
};

/* ── habit_satisfaction_rules ─────────────────────────────────────────────
 * Cross-domain rule: a habit is met when another domain's aggregate clears a
 * minimum (e.g. "hydration habit met when water_logs >= 2000 ml").
 */
const habitSatisfactionRulesBusinessShape = {
  habitId: z.string(),
  sourceDomain: domainEnum,
  sourceKind: z.string(),
  aggregateField: z.string(),
  minimumValue: z.number().int(),
  unit: z.string().nullable(),
};

export const habitSatisfactionRulesRecord = z.object({
  ...mutableBaseShape,
  ...habitSatisfactionRulesBusinessShape,
});
export const habitSatisfactionRulesCreate = z.object({
  ...mutableCreateBaseShape,
  ...habitSatisfactionRulesBusinessShape,
});
export const habitSatisfactionRulesUpdate = z
  .object(habitSatisfactionRulesBusinessShape)
  .partial();
export const habitSatisfactionRulesQuery = z.object({
  userId: z.string(),
  habitId: z.string().optional(),
  sourceDomain: domainEnum.optional(),
});

export type HabitSatisfactionRuleRecord = z.infer<typeof habitSatisfactionRulesRecord>;
export type HabitSatisfactionRuleCreate = z.infer<typeof habitSatisfactionRulesCreate>;
export type HabitSatisfactionRuleUpdate = z.infer<typeof habitSatisfactionRulesUpdate>;
export type HabitSatisfactionRuleQuery = z.infer<typeof habitSatisfactionRulesQuery>;

const habitSatisfactionRulesTable: TableDescriptor = {
  name: 'habit_satisfaction_rules',
  columns: [
    ...mutableBaseColumns,
    { name: 'habitId', type: 'uuid', notNull: true, references: 'habits' },
    { name: 'sourceDomain', type: 'text', notNull: true, enum: 'domain' },
    { name: 'sourceKind', type: 'text', notNull: true },
    { name: 'aggregateField', type: 'text', notNull: true },
    { name: 'minimumValue', type: 'integer', notNull: true },
    { name: 'unit', type: 'text', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'habitId', 'sourceDomain', 'sourceKind', 'aggregateField']],
  indexes: [],
};

/* ── skills ───────────────────────────────────────────────────────────────
 * A practice track measured in cumulative minutes.
 */
const skillsBusinessShape = {
  name: z.string(),
  targetMinutes: z.number().int().nullable(),
  isArchived: z.boolean(),
};

export const skillsRecord = z.object({
  ...mutableBaseShape,
  ...skillsBusinessShape,
});
export const skillsCreate = z.object({
  ...mutableCreateBaseShape,
  ...skillsBusinessShape,
});
export const skillsUpdate = z.object(skillsBusinessShape).partial();
export const skillsQuery = z.object({
  userId: z.string(),
  isArchived: z.boolean().optional(),
});

export type SkillRecord = z.infer<typeof skillsRecord>;
export type SkillCreate = z.infer<typeof skillsCreate>;
export type SkillUpdate = z.infer<typeof skillsUpdate>;
export type SkillQuery = z.infer<typeof skillsQuery>;

const skillsTable: TableDescriptor = {
  name: 'skills',
  columns: [
    ...mutableBaseColumns,
    { name: 'name', type: 'text', notNull: true },
    { name: 'targetMinutes', type: 'integer', notNull: false },
    { name: 'isArchived', type: 'boolean', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'name']],
  indexes: [],
};

/* ── skill_milestones ─────────────────────────────────────────────────────
 * Ordered checkpoints within a skill.
 */
const skillMilestonesBusinessShape = {
  skillId: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  completedAt: z.string().nullable(),
};

export const skillMilestonesRecord = z.object({
  ...mutableBaseShape,
  ...skillMilestonesBusinessShape,
});
export const skillMilestonesCreate = z.object({
  ...mutableCreateBaseShape,
  ...skillMilestonesBusinessShape,
});
export const skillMilestonesUpdate = z.object(skillMilestonesBusinessShape).partial();
export const skillMilestonesQuery = z.object({
  userId: z.string(),
  skillId: z.string().optional(),
});

export type SkillMilestoneRecord = z.infer<typeof skillMilestonesRecord>;
export type SkillMilestoneCreate = z.infer<typeof skillMilestonesCreate>;
export type SkillMilestoneUpdate = z.infer<typeof skillMilestonesUpdate>;
export type SkillMilestoneQuery = z.infer<typeof skillMilestonesQuery>;

const skillMilestonesTable: TableDescriptor = {
  name: 'skill_milestones',
  columns: [
    ...mutableBaseColumns,
    { name: 'skillId', type: 'uuid', notNull: true, references: 'skills' },
    { name: 'label', type: 'text', notNull: true },
    { name: 'sortOrder', type: 'integer', notNull: true },
    { name: 'completedAt', type: 'timestamp', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'skillId', 'sortOrder']],
  indexes: [],
};

/* ── skill_sessions ───────────────────────────────────────────────────────
 * A dated practice block in integer minutes; may be estimated from capture.
 */
const skillSessionsBusinessShape = {
  skillId: z.string(),
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  minutes: z.number().int(),
  source: z.string(),
  note: z.string().nullable(),
  confidenceBps: z.number().int().min(0).max(10000),
  estimated: z.boolean(),
};

export const skillSessionsRecord = z.object({
  ...mutableBaseShape,
  ...skillSessionsBusinessShape,
});
export const skillSessionsCreate = z.object({
  ...mutableCreateBaseShape,
  ...skillSessionsBusinessShape,
});
export const skillSessionsUpdate = z.object(skillSessionsBusinessShape).partial();
export const skillSessionsQuery = z.object({
  userId: z.string(),
  skillId: z.string().optional(),
  localDate: z.string().optional(),
  estimated: z.boolean().optional(),
});

export type SkillSessionRecord = z.infer<typeof skillSessionsRecord>;
export type SkillSessionCreate = z.infer<typeof skillSessionsCreate>;
export type SkillSessionUpdate = z.infer<typeof skillSessionsUpdate>;
export type SkillSessionQuery = z.infer<typeof skillSessionsQuery>;

const skillSessionsTable: TableDescriptor = {
  name: 'skill_sessions',
  columns: [
    ...mutableBaseColumns,
    { name: 'skillId', type: 'uuid', notNull: true, references: 'skills' },
    { name: 'occurredAt', type: 'timestamp', notNull: true },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'timezone', type: 'text', notNull: true },
    { name: 'minutes', type: 'integer', notNull: true },
    { name: 'source', type: 'text', notNull: true },
    { name: 'note', type: 'text', notNull: false },
    { name: 'confidenceBps', type: 'integer', notNull: true },
    { name: 'estimated', type: 'boolean', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'skillId', 'localDate']],
};

/* ────────────────────────────────────────────────────────────────────────────
 * §4.6 PLAN, PROGRESS, COACH, AND EVIDENCE TABLES
 *   JSON columns carry ONLY the named support shapes (ruleJson→PlanRule,
 *   statsJson→DomainStatsSnapshot, evidenceJson→CoachEvidence, adaptation
 *   before/after→CommitRowSnapshot). day_one_snapshots + coach_notes are
 *   immutable (record/create/query only).
 * ────────────────────────────────────────────────────────────────────────── */

/* ── plan_arcs ────────────────────────────────────────────────────────────
 * A time-boxed plan span for a domain.
 */
const planArcsBusinessShape = {
  domain: domainEnum,
  mode: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  dayNumber: z.number().int(),
  status: z.string(),
};

export const planArcsRecord = z.object({
  ...mutableBaseShape,
  ...planArcsBusinessShape,
});
export const planArcsCreate = z.object({
  ...mutableCreateBaseShape,
  ...planArcsBusinessShape,
});
export const planArcsUpdate = z.object(planArcsBusinessShape).partial();
export const planArcsQuery = z.object({
  userId: z.string(),
  domain: domainEnum.optional(),
  status: z.string().optional(),
});

export type PlanArcRecord = z.infer<typeof planArcsRecord>;
export type PlanArcCreate = z.infer<typeof planArcsCreate>;
export type PlanArcUpdate = z.infer<typeof planArcsUpdate>;
export type PlanArcQuery = z.infer<typeof planArcsQuery>;

const planArcsTable: TableDescriptor = {
  name: 'plan_arcs',
  columns: [
    ...mutableBaseColumns,
    { name: 'domain', type: 'text', notNull: true, enum: 'domain' },
    { name: 'mode', type: 'text', notNull: true },
    { name: 'title', type: 'text', notNull: true },
    { name: 'startDate', type: 'date', notNull: true },
    { name: 'endDate', type: 'date', notNull: false },
    { name: 'dayNumber', type: 'integer', notNull: true },
    { name: 'status', type: 'text', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'domain', 'status']],
};

/* ── plan_items ───────────────────────────────────────────────────────────
 * A single actionable within an arc; `ruleJson` (PlanRule) may auto-complete
 * it from another domain's aggregate.
 */
const planItemsBusinessShape = {
  arcId: z.string(),
  domain: domainEnum,
  kind: planItemKindEnum,
  title: z.string(),
  dueAt: z.string().nullable(),
  localDate: z.string(),
  targetValue: z.number().int().nullable(),
  targetUnit: z.string().nullable(),
  status: planItemStatusEnum,
  completionSource: completionSourceEnum.nullable(),
  ruleJson: planRule.nullable(),
  linkedHabitId: z.string().nullable(),
  linkedSkillId: z.string().nullable(),
};

export const planItemsRecord = z.object({
  ...mutableBaseShape,
  ...planItemsBusinessShape,
});
export const planItemsCreate = z.object({
  ...mutableCreateBaseShape,
  ...planItemsBusinessShape,
});
export const planItemsUpdate = z.object(planItemsBusinessShape).partial();
export const planItemsQuery = z.object({
  userId: z.string(),
  arcId: z.string().optional(),
  localDate: z.string().optional(),
  status: planItemStatusEnum.optional(),
});

export type PlanItemRecord = z.infer<typeof planItemsRecord>;
export type PlanItemCreate = z.infer<typeof planItemsCreate>;
export type PlanItemUpdate = z.infer<typeof planItemsUpdate>;
export type PlanItemQuery = z.infer<typeof planItemsQuery>;

const planItemsTable: TableDescriptor = {
  name: 'plan_items',
  columns: [
    ...mutableBaseColumns,
    { name: 'arcId', type: 'uuid', notNull: true, references: 'plan_arcs' },
    { name: 'domain', type: 'text', notNull: true, enum: 'domain' },
    { name: 'kind', type: 'text', notNull: true, enum: 'planItemKind' },
    { name: 'title', type: 'text', notNull: true },
    { name: 'dueAt', type: 'timestamp', notNull: false },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'targetValue', type: 'integer', notNull: false },
    { name: 'targetUnit', type: 'text', notNull: false },
    { name: 'status', type: 'text', notNull: true, enum: 'planItemStatus' },
    { name: 'completionSource', type: 'text', notNull: false, enum: 'completionSource' },
    { name: 'ruleJson', type: 'json', notNull: false, jsonShape: 'PlanRule' },
    { name: 'linkedHabitId', type: 'uuid', notNull: false, references: 'habits' },
    { name: 'linkedSkillId', type: 'uuid', notNull: false, references: 'skills' },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [
    ['userId', 'localDate', 'status'],
    ['userId', 'arcId', 'status'],
  ],
};

/* ── domain_progress ──────────────────────────────────────────────────────
 * Per-domain XP/level/streak rollup (one row per user per domain).
 */
const domainProgressBusinessShape = {
  domain: domainEnum,
  xp: z.number().int(),
  level: z.number().int(),
  streak: z.number().int(),
  bestStreak: z.number().int(),
  cumulativeMinutes: z.number().int(),
  lastActiveDate: z.string().nullable(),
};

export const domainProgressRecord = z.object({
  ...mutableBaseShape,
  ...domainProgressBusinessShape,
});
export const domainProgressCreate = z.object({
  ...mutableCreateBaseShape,
  ...domainProgressBusinessShape,
});
export const domainProgressUpdate = z.object(domainProgressBusinessShape).partial();
export const domainProgressQuery = z.object({
  userId: z.string(),
  domain: domainEnum.optional(),
});

export type DomainProgressRecord = z.infer<typeof domainProgressRecord>;
export type DomainProgressCreate = z.infer<typeof domainProgressCreate>;
export type DomainProgressUpdate = z.infer<typeof domainProgressUpdate>;
export type DomainProgressQuery = z.infer<typeof domainProgressQuery>;

const domainProgressTable: TableDescriptor = {
  name: 'domain_progress',
  columns: [
    ...mutableBaseColumns,
    { name: 'domain', type: 'text', notNull: true, enum: 'domain' },
    { name: 'xp', type: 'integer', notNull: true },
    { name: 'level', type: 'integer', notNull: true },
    { name: 'streak', type: 'integer', notNull: true },
    { name: 'bestStreak', type: 'integer', notNull: true },
    { name: 'cumulativeMinutes', type: 'integer', notNull: true },
    { name: 'lastActiveDate', type: 'date', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'domain']],
  indexes: [],
};

/* ── day_one_snapshots (immutable) ────────────────────────────────────────
 * Frozen "day one" stats per domain for before/after framing.
 */
const dayOneSnapshotsBusinessShape = {
  domain: domainEnum,
  snapshotDate: z.string(),
  statsJson: domainStatsSnapshot,
};

export const dayOneSnapshotsRecord = z.object({
  ...immutableBaseShape,
  ...dayOneSnapshotsBusinessShape,
});
export const dayOneSnapshotsCreate = z.object({
  ...immutableCreateBaseShape,
  ...dayOneSnapshotsBusinessShape,
});
export const dayOneSnapshotsQuery = z.object({
  userId: z.string(),
  domain: domainEnum.optional(),
});

export type DayOneSnapshotRecord = z.infer<typeof dayOneSnapshotsRecord>;
export type DayOneSnapshotCreate = z.infer<typeof dayOneSnapshotsCreate>;
export type DayOneSnapshotQuery = z.infer<typeof dayOneSnapshotsQuery>;

const dayOneSnapshotsTable: TableDescriptor = {
  name: 'day_one_snapshots',
  columns: [
    ...immutableBaseColumns,
    { name: 'domain', type: 'text', notNull: true, enum: 'domain' },
    { name: 'snapshotDate', type: 'date', notNull: true },
    { name: 'statsJson', type: 'json', notNull: true, jsonShape: 'DomainStatsSnapshot' },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'domain']],
  indexes: [],
};

/* ── coach_notes (immutable) ──────────────────────────────────────────────
 * A generated coach reaction/brief/reflection with its grounding evidence.
 */
const coachNotesBusinessShape = {
  scope: coachScopeEnum,
  localDate: z.string(),
  text: z.string(),
  modelProvider: z.string(),
  modelId: z.string(),
  evidenceJson: coachEvidence,
  stalenessKey: z.string(),
};

export const coachNotesRecord = z.object({
  ...immutableBaseShape,
  ...coachNotesBusinessShape,
});
export const coachNotesCreate = z.object({
  ...immutableCreateBaseShape,
  ...coachNotesBusinessShape,
});
export const coachNotesQuery = z.object({
  userId: z.string(),
  scope: coachScopeEnum.optional(),
  localDate: z.string().optional(),
});

export type CoachNoteRecord = z.infer<typeof coachNotesRecord>;
export type CoachNoteCreate = z.infer<typeof coachNotesCreate>;
export type CoachNoteQuery = z.infer<typeof coachNotesQuery>;

const coachNotesTable: TableDescriptor = {
  name: 'coach_notes',
  columns: [
    ...immutableBaseColumns,
    { name: 'scope', type: 'text', notNull: true, enum: 'coachScope' },
    { name: 'localDate', type: 'date', notNull: true },
    { name: 'text', type: 'text', notNull: true },
    { name: 'modelProvider', type: 'text', notNull: true },
    { name: 'modelId', type: 'text', notNull: true },
    { name: 'evidenceJson', type: 'json', notNull: true, jsonShape: 'CoachEvidence' },
    { name: 'stalenessKey', type: 'text', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'scope', 'stalenessKey']],
  indexes: [['userId', 'localDate', 'scope']],
};

/* ── adaptations ──────────────────────────────────────────────────────────
 * Glass-box plan change: before → after → reason, revertible. before/after
 * are bounded CommitRowSnapshot values, never a generic passthrough.
 */
const adaptationsBusinessShape = {
  planItemId: z.string(),
  beforeJson: commitRowSnapshot,
  afterJson: commitRowSnapshot,
  reason: z.string(),
  status: adaptationStatusEnum,
  keptAt: z.string().nullable(),
  revertedAt: z.string().nullable(),
};

export const adaptationsRecord = z.object({
  ...mutableBaseShape,
  ...adaptationsBusinessShape,
});
export const adaptationsCreate = z.object({
  ...mutableCreateBaseShape,
  ...adaptationsBusinessShape,
});
export const adaptationsUpdate = z.object(adaptationsBusinessShape).partial();
export const adaptationsQuery = z.object({
  userId: z.string(),
  status: adaptationStatusEnum.optional(),
  planItemId: z.string().optional(),
});

export type AdaptationRecord = z.infer<typeof adaptationsRecord>;
export type AdaptationCreate = z.infer<typeof adaptationsCreate>;
export type AdaptationUpdate = z.infer<typeof adaptationsUpdate>;
export type AdaptationQuery = z.infer<typeof adaptationsQuery>;

const adaptationsTable: TableDescriptor = {
  name: 'adaptations',
  columns: [
    ...mutableBaseColumns,
    { name: 'planItemId', type: 'uuid', notNull: true, references: 'plan_items' },
    { name: 'beforeJson', type: 'json', notNull: true, jsonShape: 'CommitRowSnapshot' },
    { name: 'afterJson', type: 'json', notNull: true, jsonShape: 'CommitRowSnapshot' },
    { name: 'reason', type: 'text', notNull: true },
    { name: 'status', type: 'text', notNull: true, enum: 'adaptationStatus' },
    { name: 'keptAt', type: 'timestamp', notNull: false },
    { name: 'revertedAt', type: 'timestamp', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'status', 'createdAt']],
};

/* ── evidence ─────────────────────────────────────────────────────────────
 * Stored capture artefacts (photos/audio), sha256-deduped, linked to entries.
 */
const evidenceBusinessShape = {
  domain: domainEnum,
  entryKind: z.string(),
  entryId: z.string().nullable(),
  storageProvider: z.string(),
  storagePath: z.string(),
  mimeType: z.string(),
  sha256: z.string(),
  caption: z.string().nullable(),
  occurredAt: z.string(),
  localDate: z.string(),
};

export const evidenceRecord = z.object({
  ...mutableBaseShape,
  ...evidenceBusinessShape,
});
export const evidenceCreate = z.object({
  ...mutableCreateBaseShape,
  ...evidenceBusinessShape,
});
export const evidenceUpdate = z.object(evidenceBusinessShape).partial();
export const evidenceQuery = z.object({
  userId: z.string(),
  entryKind: z.string().optional(),
  entryId: z.string().optional(),
});

export type EvidenceRecord = z.infer<typeof evidenceRecord>;
export type EvidenceCreate = z.infer<typeof evidenceCreate>;
export type EvidenceUpdate = z.infer<typeof evidenceUpdate>;
export type EvidenceQuery = z.infer<typeof evidenceQuery>;

const evidenceTable: TableDescriptor = {
  name: 'evidence',
  columns: [
    ...mutableBaseColumns,
    { name: 'domain', type: 'text', notNull: true, enum: 'domain' },
    { name: 'entryKind', type: 'text', notNull: true },
    { name: 'entryId', type: 'uuid', notNull: false },
    { name: 'storageProvider', type: 'text', notNull: true },
    { name: 'storagePath', type: 'text', notNull: true },
    { name: 'mimeType', type: 'text', notNull: true },
    { name: 'sha256', type: 'text', notNull: true },
    { name: 'caption', type: 'text', notNull: false },
    { name: 'occurredAt', type: 'timestamp', notNull: true },
    { name: 'localDate', type: 'date', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'sha256']],
  indexes: [['userId', 'entryKind', 'entryId']],
};

/* ────────────────────────────────────────────────────────────────────────────
 * §4.7 COMMIT/UNDO AND BILLING TABLES
 *   Commit + effect tables are immutable audit rows (record/create/query only).
 *   commit_rows before/after carry CommitRowSnapshot; effect snapshots keep
 *   status/source as plain text so past rows survive enum evolution.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── commits (immutable) ──────────────────────────────────────────────────
 * One undoable commit envelope; every write is reversible within its window.
 */
const commitsBusinessShape = {
  draftId: z.string().nullable(),
  idempotencyKey: z.string(),
  kind: commitKindEnum,
  status: commitStatusEnum,
  undoExpiresAt: z.string(),
  undoneAt: z.string().nullable(),
  summary: z.string(),
};

export const commitsRecord = z.object({
  ...immutableBaseShape,
  ...commitsBusinessShape,
});
export const commitsCreate = z.object({
  ...immutableCreateBaseShape,
  ...commitsBusinessShape,
});
export const commitsQuery = z.object({
  userId: z.string(),
  status: commitStatusEnum.optional(),
  idempotencyKey: z.string().optional(),
});

export type CommitRecord = z.infer<typeof commitsRecord>;
export type CommitCreate = z.infer<typeof commitsCreate>;
export type CommitQuery = z.infer<typeof commitsQuery>;

const commitsTable: TableDescriptor = {
  name: 'commits',
  columns: [
    ...immutableBaseColumns,
    { name: 'draftId', type: 'text', notNull: false },
    { name: 'idempotencyKey', type: 'text', notNull: true },
    { name: 'kind', type: 'text', notNull: true, enum: 'commitKind' },
    { name: 'status', type: 'text', notNull: true, enum: 'commitStatus' },
    { name: 'undoExpiresAt', type: 'timestamp', notNull: true },
    { name: 'undoneAt', type: 'timestamp', notNull: false },
    { name: 'summary', type: 'text', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'idempotencyKey']],
  indexes: [['userId', 'status', 'createdAt']],
};

/* ── commit_rows (immutable) ──────────────────────────────────────────────
 * Per-row before/after snapshot for a commit; drives typed glass-box undo.
 */
const commitRowsBusinessShape = {
  commitId: z.string(),
  entryKind: z.string(),
  entryId: z.string(),
  operation: operationEnum,
  beforeJson: commitRowSnapshot.nullable(),
  afterJson: commitRowSnapshot.nullable(),
};

export const commitRowsRecord = z.object({
  ...immutableBaseShape,
  ...commitRowsBusinessShape,
});
export const commitRowsCreate = z.object({
  ...immutableCreateBaseShape,
  ...commitRowsBusinessShape,
});
export const commitRowsQuery = z.object({
  userId: z.string(),
  commitId: z.string().optional(),
});

export type CommitRowRecord = z.infer<typeof commitRowsRecord>;
export type CommitRowCreate = z.infer<typeof commitRowsCreate>;
export type CommitRowQuery = z.infer<typeof commitRowsQuery>;

const commitRowsTable: TableDescriptor = {
  name: 'commit_rows',
  columns: [
    ...immutableBaseColumns,
    { name: 'commitId', type: 'uuid', notNull: true, references: 'commits' },
    { name: 'entryKind', type: 'text', notNull: true },
    { name: 'entryId', type: 'uuid', notNull: true },
    { name: 'operation', type: 'text', notNull: true, enum: 'operation' },
    { name: 'beforeJson', type: 'json', notNull: false, jsonShape: 'CommitRowSnapshot' },
    { name: 'afterJson', type: 'json', notNull: false, jsonShape: 'CommitRowSnapshot' },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'commitId', 'entryKind', 'entryId']],
  indexes: [],
};

/* ── commit_progress_effects (immutable) ──────────────────────────────────
 * XP/level/streak/minutes deltas a commit applied, for exact reversal.
 */
const commitProgressEffectsBusinessShape = {
  commitId: z.string(),
  domain: domainEnum,
  xpDelta: z.number().int(),
  levelBefore: z.number().int(),
  levelAfter: z.number().int(),
  streakBefore: z.number().int(),
  streakAfter: z.number().int(),
  minutesDelta: z.number().int(),
};

export const commitProgressEffectsRecord = z.object({
  ...immutableBaseShape,
  ...commitProgressEffectsBusinessShape,
});
export const commitProgressEffectsCreate = z.object({
  ...immutableCreateBaseShape,
  ...commitProgressEffectsBusinessShape,
});
export const commitProgressEffectsQuery = z.object({
  userId: z.string(),
  commitId: z.string().optional(),
});

export type CommitProgressEffectRecord = z.infer<typeof commitProgressEffectsRecord>;
export type CommitProgressEffectCreate = z.infer<typeof commitProgressEffectsCreate>;
export type CommitProgressEffectQuery = z.infer<typeof commitProgressEffectsQuery>;

const commitProgressEffectsTable: TableDescriptor = {
  name: 'commit_progress_effects',
  columns: [
    ...immutableBaseColumns,
    { name: 'commitId', type: 'uuid', notNull: true, references: 'commits' },
    { name: 'domain', type: 'text', notNull: true, enum: 'domain' },
    { name: 'xpDelta', type: 'integer', notNull: true },
    { name: 'levelBefore', type: 'integer', notNull: true },
    { name: 'levelAfter', type: 'integer', notNull: true },
    { name: 'streakBefore', type: 'integer', notNull: true },
    { name: 'streakAfter', type: 'integer', notNull: true },
    { name: 'minutesDelta', type: 'integer', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [],
  indexes: [['userId', 'commitId']],
};

/* ── commit_plan_effects (immutable) ──────────────────────────────────────
 * Plan-item status/source transitions a commit caused. Snapshot columns are
 * plain text so historic rows tolerate enum evolution.
 */
const commitPlanEffectsBusinessShape = {
  commitId: z.string(),
  planItemId: z.string(),
  statusBefore: z.string(),
  statusAfter: z.string(),
  completionSourceBefore: z.string().nullable(),
  completionSourceAfter: z.string().nullable(),
};

export const commitPlanEffectsRecord = z.object({
  ...immutableBaseShape,
  ...commitPlanEffectsBusinessShape,
});
export const commitPlanEffectsCreate = z.object({
  ...immutableCreateBaseShape,
  ...commitPlanEffectsBusinessShape,
});
export const commitPlanEffectsQuery = z.object({
  userId: z.string(),
  commitId: z.string().optional(),
  planItemId: z.string().optional(),
});

export type CommitPlanEffectRecord = z.infer<typeof commitPlanEffectsRecord>;
export type CommitPlanEffectCreate = z.infer<typeof commitPlanEffectsCreate>;
export type CommitPlanEffectQuery = z.infer<typeof commitPlanEffectsQuery>;

const commitPlanEffectsTable: TableDescriptor = {
  name: 'commit_plan_effects',
  columns: [
    ...immutableBaseColumns,
    { name: 'commitId', type: 'uuid', notNull: true, references: 'commits' },
    { name: 'planItemId', type: 'uuid', notNull: true, references: 'plan_items' },
    { name: 'statusBefore', type: 'text', notNull: true },
    { name: 'statusAfter', type: 'text', notNull: true },
    { name: 'completionSourceBefore', type: 'text', notNull: false },
    { name: 'completionSourceAfter', type: 'text', notNull: false },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'commitId', 'planItemId']],
  indexes: [],
};

/* ── checkout_sessions ────────────────────────────────────────────────────
 * A hosted checkout attempt; amountPaise integer, currency INR.
 */
const checkoutSessionsBusinessShape = {
  provider: billingProviderEnum,
  providerReceiptId: z.string(),
  amountPaise: z.number().int().nonnegative(),
  currency: currencyEnum,
  status: z.string(),
  checkoutUrl: z.string().nullable(),
  expiresAt: z.string(),
};

export const checkoutSessionsRecord = z.object({
  ...mutableBaseShape,
  ...checkoutSessionsBusinessShape,
});
export const checkoutSessionsCreate = z.object({
  ...mutableCreateBaseShape,
  ...checkoutSessionsBusinessShape,
});
export const checkoutSessionsUpdate = z.object(checkoutSessionsBusinessShape).partial();
export const checkoutSessionsQuery = z.object({
  userId: z.string(),
  status: z.string().optional(),
  providerReceiptId: z.string().optional(),
});

export type CheckoutSessionRecord = z.infer<typeof checkoutSessionsRecord>;
export type CheckoutSessionCreate = z.infer<typeof checkoutSessionsCreate>;
export type CheckoutSessionUpdate = z.infer<typeof checkoutSessionsUpdate>;
export type CheckoutSessionQuery = z.infer<typeof checkoutSessionsQuery>;

const checkoutSessionsTable: TableDescriptor = {
  name: 'checkout_sessions',
  columns: [
    ...mutableBaseColumns,
    { name: 'provider', type: 'text', notNull: true, enum: 'billingProvider' },
    { name: 'providerReceiptId', type: 'text', notNull: true },
    { name: 'amountPaise', type: 'integer', notNull: true },
    { name: 'currency', type: 'text', notNull: true, enum: 'currency' },
    { name: 'status', type: 'text', notNull: true },
    { name: 'checkoutUrl', type: 'text', notNull: false },
    { name: 'expiresAt', type: 'timestamp', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'providerReceiptId']],
  indexes: [['userId', 'status', 'createdAt']],
};

/* ── billing_events (immutable) ───────────────────────────────────────────
 * Provider webhook ledger. The unique key is GLOBAL (provider,
 * providerEventId) — deliberately excludes userId — for webhook-replay
 * idempotency. Every row still carries a non-null userId.
 */
const billingEventsBusinessShape = {
  provider: billingProviderEnum,
  providerEventId: z.string(),
  eventType: z.string(),
  checkoutSessionId: z.string().nullable(),
  paymentId: z.string().nullable(),
  outcome: z.string(),
  payloadHash: z.string(),
  processedAt: z.string().nullable(),
};

export const billingEventsRecord = z.object({
  ...immutableBaseShape,
  ...billingEventsBusinessShape,
});
export const billingEventsCreate = z.object({
  ...immutableCreateBaseShape,
  ...billingEventsBusinessShape,
});
export const billingEventsQuery = z.object({
  userId: z.string(),
  provider: billingProviderEnum.optional(),
  eventType: z.string().optional(),
});

export type BillingEventRecord = z.infer<typeof billingEventsRecord>;
export type BillingEventCreate = z.infer<typeof billingEventsCreate>;
export type BillingEventQuery = z.infer<typeof billingEventsQuery>;

const billingEventsTable: TableDescriptor = {
  name: 'billing_events',
  columns: [
    ...immutableBaseColumns,
    { name: 'provider', type: 'text', notNull: true, enum: 'billingProvider' },
    { name: 'providerEventId', type: 'text', notNull: true },
    { name: 'eventType', type: 'text', notNull: true },
    { name: 'checkoutSessionId', type: 'uuid', notNull: false, references: 'checkout_sessions' },
    { name: 'paymentId', type: 'text', notNull: false },
    { name: 'outcome', type: 'text', notNull: true },
    { name: 'payloadHash', type: 'text', notNull: true },
    { name: 'processedAt', type: 'timestamp', notNull: false },
  ],
  primaryKey: ['id'],
  // Global idempotency key — intentionally excludes userId (webhook replay).
  unique: [['provider', 'providerEventId']],
  indexes: [['userId', 'createdAt']],
};

/* ── waitlist_requests (immutable) ────────────────────────────────────────
 * One pricing-page waitlist request per authenticated user.
 */
const waitlistRequestsBusinessShape = {
  source: waitlistSourceEnum,
  requestedAt: z.string(),
};

export const waitlistRequestsRecord = z.object({
  ...immutableBaseShape,
  ...waitlistRequestsBusinessShape,
});
export const waitlistRequestsCreate = z.object({
  ...immutableCreateBaseShape,
  ...waitlistRequestsBusinessShape,
});
export const waitlistRequestsQuery = z.object({
  userId: z.string(),
  source: waitlistSourceEnum.optional(),
});

export type WaitlistRequestRecord = z.infer<typeof waitlistRequestsRecord>;
export type WaitlistRequestCreate = z.infer<typeof waitlistRequestsCreate>;
export type WaitlistRequestQuery = z.infer<typeof waitlistRequestsQuery>;

const waitlistRequestsTable: TableDescriptor = {
  name: 'waitlist_requests',
  columns: [
    ...immutableBaseColumns,
    { name: 'source', type: 'text', notNull: true, enum: 'waitlistSource' },
    { name: 'requestedAt', type: 'timestamp', notNull: true },
  ],
  primaryKey: ['id'],
  unique: [['userId', 'source']],
  indexes: [],
};

/* ────────────────────────────────────────────────────────────────────────────
 * 6. REGISTRY — every table descriptor + its Zod contract set.
 *    Append §4.3–§4.7 entries here as their sections are authored.
 * ────────────────────────────────────────────────────────────────────────── */

export const schemaContract = {
  profiles: {
    descriptor: profilesTable,
    record: profilesRecord,
    create: profilesCreate,
    update: profilesUpdate,
    query: profilesQuery,
  },
  profile_gaps: {
    descriptor: profileGapsTable,
    record: profileGapsRecord,
    create: profileGapsCreate,
    update: profileGapsUpdate,
    query: profileGapsQuery,
  },
  seed_runs: {
    descriptor: seedRunsTable,
    record: seedRunsRecord,
    create: seedRunsCreate,
    query: seedRunsQuery,
  },
  money_categories: {
    descriptor: moneyCategoriesTable,
    record: moneyCategoriesRecord,
    create: moneyCategoriesCreate,
    update: moneyCategoriesUpdate,
    query: moneyCategoriesQuery,
  },
  transactions: {
    descriptor: transactionsTable,
    record: transactionsRecord,
    create: transactionsCreate,
    update: transactionsUpdate,
    query: transactionsQuery,
  },
  recurring_rules: {
    descriptor: recurringRulesTable,
    record: recurringRulesRecord,
    create: recurringRulesCreate,
    update: recurringRulesUpdate,
    query: recurringRulesQuery,
  },
  budgets: {
    descriptor: budgetsTable,
    record: budgetsRecord,
    create: budgetsCreate,
    update: budgetsUpdate,
    query: budgetsQuery,
  },
  meals: {
    descriptor: mealsTable,
    record: mealsRecord,
    create: mealsCreate,
    update: mealsUpdate,
    query: mealsQuery,
  },
  meal_items: {
    descriptor: mealItemsTable,
    record: mealItemsRecord,
    create: mealItemsCreate,
    update: mealItemsUpdate,
    query: mealItemsQuery,
  },
  water_logs: {
    descriptor: waterLogsTable,
    record: waterLogsRecord,
    create: waterLogsCreate,
    update: waterLogsUpdate,
    query: waterLogsQuery,
  },
  workouts: {
    descriptor: workoutsTable,
    record: workoutsRecord,
    create: workoutsCreate,
    update: workoutsUpdate,
    query: workoutsQuery,
  },
  workout_exercises: {
    descriptor: workoutExercisesTable,
    record: workoutExercisesRecord,
    create: workoutExercisesCreate,
    update: workoutExercisesUpdate,
    query: workoutExercisesQuery,
  },
  weigh_ins: {
    descriptor: weighInsTable,
    record: weighInsRecord,
    create: weighInsCreate,
    update: weighInsUpdate,
    query: weighInsQuery,
  },
  habits: {
    descriptor: habitsTable,
    record: habitsRecord,
    create: habitsCreate,
    update: habitsUpdate,
    query: habitsQuery,
  },
  habit_logs: {
    descriptor: habitLogsTable,
    record: habitLogsRecord,
    create: habitLogsCreate,
    update: habitLogsUpdate,
    query: habitLogsQuery,
  },
  habit_satisfaction_rules: {
    descriptor: habitSatisfactionRulesTable,
    record: habitSatisfactionRulesRecord,
    create: habitSatisfactionRulesCreate,
    update: habitSatisfactionRulesUpdate,
    query: habitSatisfactionRulesQuery,
  },
  skills: {
    descriptor: skillsTable,
    record: skillsRecord,
    create: skillsCreate,
    update: skillsUpdate,
    query: skillsQuery,
  },
  skill_milestones: {
    descriptor: skillMilestonesTable,
    record: skillMilestonesRecord,
    create: skillMilestonesCreate,
    update: skillMilestonesUpdate,
    query: skillMilestonesQuery,
  },
  skill_sessions: {
    descriptor: skillSessionsTable,
    record: skillSessionsRecord,
    create: skillSessionsCreate,
    update: skillSessionsUpdate,
    query: skillSessionsQuery,
  },
  plan_arcs: {
    descriptor: planArcsTable,
    record: planArcsRecord,
    create: planArcsCreate,
    update: planArcsUpdate,
    query: planArcsQuery,
  },
  plan_items: {
    descriptor: planItemsTable,
    record: planItemsRecord,
    create: planItemsCreate,
    update: planItemsUpdate,
    query: planItemsQuery,
  },
  domain_progress: {
    descriptor: domainProgressTable,
    record: domainProgressRecord,
    create: domainProgressCreate,
    update: domainProgressUpdate,
    query: domainProgressQuery,
  },
  day_one_snapshots: {
    descriptor: dayOneSnapshotsTable,
    record: dayOneSnapshotsRecord,
    create: dayOneSnapshotsCreate,
    query: dayOneSnapshotsQuery,
  },
  coach_notes: {
    descriptor: coachNotesTable,
    record: coachNotesRecord,
    create: coachNotesCreate,
    query: coachNotesQuery,
  },
  adaptations: {
    descriptor: adaptationsTable,
    record: adaptationsRecord,
    create: adaptationsCreate,
    update: adaptationsUpdate,
    query: adaptationsQuery,
  },
  evidence: {
    descriptor: evidenceTable,
    record: evidenceRecord,
    create: evidenceCreate,
    update: evidenceUpdate,
    query: evidenceQuery,
  },
  commits: {
    descriptor: commitsTable,
    record: commitsRecord,
    create: commitsCreate,
    query: commitsQuery,
  },
  commit_rows: {
    descriptor: commitRowsTable,
    record: commitRowsRecord,
    create: commitRowsCreate,
    query: commitRowsQuery,
  },
  commit_progress_effects: {
    descriptor: commitProgressEffectsTable,
    record: commitProgressEffectsRecord,
    create: commitProgressEffectsCreate,
    query: commitProgressEffectsQuery,
  },
  commit_plan_effects: {
    descriptor: commitPlanEffectsTable,
    record: commitPlanEffectsRecord,
    create: commitPlanEffectsCreate,
    query: commitPlanEffectsQuery,
  },
  checkout_sessions: {
    descriptor: checkoutSessionsTable,
    record: checkoutSessionsRecord,
    create: checkoutSessionsCreate,
    update: checkoutSessionsUpdate,
    query: checkoutSessionsQuery,
  },
  billing_events: {
    descriptor: billingEventsTable,
    record: billingEventsRecord,
    create: billingEventsCreate,
    query: billingEventsQuery,
  },
  waitlist_requests: {
    descriptor: waitlistRequestsTable,
    record: waitlistRequestsRecord,
    create: waitlistRequestsCreate,
    query: waitlistRequestsQuery,
  },
} satisfies Record<string, TableContract>;

export type SchemaContract = typeof schemaContract;
export type TableName = keyof SchemaContract;

/** Flat list of descriptors for the dialect files to iterate. */
export const allTableDescriptors: readonly TableDescriptor[] = Object.values(
  schemaContract,
).map((entry) => entry.descriptor);
