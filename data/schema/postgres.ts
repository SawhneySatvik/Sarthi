/**
 * data/schema/postgres.ts — Postgres (prod) dialect tables.
 *
 * These Drizzle table definitions are the Postgres half of the dual-dialect
 * schema (SQLite lives in ./sqlite.ts). The declarative descriptors in
 * ./contract.ts are the source of truth; each table here mirrors its
 * descriptor's columns / primaryKey / unique / indexes exactly so the step-8
 * parity test passes. Column *names* are the descriptor `name` strings verbatim.
 *
 * Column-type mapping (contract `type` → drizzle/pg-core):
 *   uuid | text | string | date | timestamp | localDate → text(col)
 *   integer (incl. *Paise, quantities, counts)           → integer(col)
 *   boolean                                              → boolean(col)
 *   json                                                 → jsonb(col).$type<Shape>()
 */

// `boolean` is imported ahead of §4.3 (money) tables that use it.
import { pgTable, index, uniqueIndex, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

import type {
  PlanRule,
  DomainStatsSnapshot,
  CoachEvidence,
  CommitRowSnapshot,
} from '@/data/schema/contract';

/* ── Base-column helpers ──────────────────────────────────────────────────
 * Mirror mutableBaseColumns / immutableBaseColumns in ./contract.ts.
 * `userId` is NOT NULL on every table.
 */
const mutableBase = {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
  deletedAt: text('deletedAt'),
};

const immutableBase = {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  createdAt: text('createdAt').notNull(),
};

/* ────────────────────────────────────────────────────────────────────────────
 * §4.2 PROFILE / ONBOARDING TABLES
 * ────────────────────────────────────────────────────────────────────────── */

/* ── profiles ──────────────────────────────────────────────────────────────
 * PK is userId (no separate id, no deletedAt). Matches profilesTable.
 */
export const profiles = pgTable(
  'profiles',
  {
    userId: text('userId').primaryKey(),
    displayName: text('displayName'),
    birthDate: text('birthDate'),
    heightCm: integer('heightCm'),
    weightGrams: integer('weightGrams'),
    unitSystem: text('unitSystem').notNull(),
    theme: text('theme').notNull(),
    themeMode: text('themeMode').notNull(),
    wakeTimeMinutes: integer('wakeTimeMinutes'),
    sleepTimeMinutes: integer('sleepTimeMinutes'),
    timeBudgetMinutes: integer('timeBudgetMinutes'),
    foodPattern: text('foodPattern'),
    screenTimeMinutes: integer('screenTimeMinutes'),
    focusPreference: text('focusPreference'),
    careerGoal: text('careerGoal'),
    moneyGoal: text('moneyGoal'),
    plan: text('plan').notNull(),
    onboardingStatus: text('onboardingStatus').notNull(),
    onboardingStep: integer('onboardingStep').notNull(),
    seedVersion: integer('seedVersion'),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
  },
  (t) => [index('profiles_onboardingStatus_updatedAt_idx').on(t.onboardingStatus, t.updatedAt)],
);

/* ── profile_gaps ──────────────────────────────────────────────────────────
 * Mutable base. Matches profileGapsTable.
 */
export const profileGaps = pgTable(
  'profile_gaps',
  {
    ...mutableBase,
    gapKey: text('gapKey').notNull(),
    prompt: text('prompt').notNull(),
    optionsJson: jsonb('optionsJson').$type<string[]>(),
    status: text('status').notNull(),
    answeredAt: text('answeredAt'),
  },
  (t) => [
    uniqueIndex('profile_gaps_userId_gapKey_uq').on(t.userId, t.gapKey),
    index('profile_gaps_userId_status_idx').on(t.userId, t.status),
  ],
);

/* ── seed_runs ─────────────────────────────────────────────────────────────
 * Immutable base. Matches seedRunsTable.
 */
export const seedRuns = pgTable(
  'seed_runs',
  {
    ...immutableBase,
    seedKey: text('seedKey').notNull(),
    seedVersion: integer('seedVersion').notNull(),
    completedAt: text('completedAt'),
  },
  (t) => [uniqueIndex('seed_runs_userId_seedKey_uq').on(t.userId, t.seedKey)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * §4.3 MONEY TABLES
 *   Money is integer *Paise only; no monetary float exists anywhere.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── money_categories — mutable base. Matches moneyCategoriesTable. */
export const moneyCategories = pgTable(
  'money_categories',
  {
    ...mutableBase,
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    colorKey: text('colorKey'),
    isSystem: boolean('isSystem').notNull(),
  },
  (t) => [uniqueIndex('money_categories_userId_name_kind_uq').on(t.userId, t.name, t.kind)],
);

/* ── transactions — mutable base. Matches transactionsTable. */
export const transactions = pgTable(
  'transactions',
  {
    ...mutableBase,
    occurredAt: text('occurredAt').notNull(),
    localDate: text('localDate').notNull(),
    timezone: text('timezone').notNull(),
    direction: text('direction').notNull(),
    amountPaise: integer('amountPaise').notNull(),
    categoryId: text('categoryId'),
    merchant: text('merchant'),
    note: text('note'),
    source: text('source').notNull(),
    confidenceBps: integer('confidenceBps').notNull(),
    estimated: boolean('estimated').notNull(),
    evidenceId: text('evidenceId'),
    recurringRuleId: text('recurringRuleId'),
  },
  (t) => [
    index('transactions_userId_localDate_idx').on(t.userId, t.localDate),
    index('transactions_userId_categoryId_localDate_idx').on(t.userId, t.categoryId, t.localDate),
    index('transactions_userId_recurringRuleId_idx').on(t.userId, t.recurringRuleId),
  ],
);

/* ── recurring_rules — mutable base. Matches recurringRulesTable. */
export const recurringRules = pgTable(
  'recurring_rules',
  {
    ...mutableBase,
    direction: text('direction').notNull(),
    amountPaise: integer('amountPaise').notNull(),
    categoryId: text('categoryId'),
    merchant: text('merchant'),
    cadence: text('cadence').notNull(),
    nextPostDate: text('nextPostDate').notNull(),
    isPaused: boolean('isPaused').notNull(),
  },
  (t) => [index('recurring_rules_userId_nextPostDate_idx').on(t.userId, t.nextPostDate)],
);

/* ── budgets — mutable base. Matches budgetsTable. */
export const budgets = pgTable(
  'budgets',
  {
    ...mutableBase,
    categoryId: text('categoryId').notNull(),
    periodStart: text('periodStart').notNull(),
    periodEnd: text('periodEnd').notNull(),
    limitPaise: integer('limitPaise').notNull(),
  },
  (t) => [
    uniqueIndex('budgets_userId_categoryId_periodStart_periodEnd_uq').on(
      t.userId,
      t.categoryId,
      t.periodStart,
      t.periodEnd,
    ),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * §4.4 HEALTH TABLES
 *   Quantities are integer grams / millilitres / minutes.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── meals — mutable base. Matches mealsTable. */
export const meals = pgTable(
  'meals',
  {
    ...mutableBase,
    occurredAt: text('occurredAt').notNull(),
    localDate: text('localDate').notNull(),
    timezone: text('timezone').notNull(),
    kcal: integer('kcal'),
    proteinGrams: integer('proteinGrams'),
    carbsGrams: integer('carbsGrams'),
    fatGrams: integer('fatGrams'),
    source: text('source').notNull(),
    confidenceBps: integer('confidenceBps').notNull(),
    estimated: boolean('estimated').notNull(),
    evidenceId: text('evidenceId'),
    note: text('note'),
  },
  (t) => [index('meals_userId_localDate_idx').on(t.userId, t.localDate)],
);

/* ── meal_items — mutable base. Matches mealItemsTable. */
export const mealItems = pgTable(
  'meal_items',
  {
    ...mutableBase,
    mealId: text('mealId').notNull(),
    name: text('name').notNull(),
    quantityGrams: integer('quantityGrams'),
    kcal: integer('kcal'),
    proteinGrams: integer('proteinGrams'),
    carbsGrams: integer('carbsGrams'),
    fatGrams: integer('fatGrams'),
    estimated: boolean('estimated').notNull(),
    confidenceBps: integer('confidenceBps').notNull(),
  },
  (t) => [index('meal_items_userId_mealId_idx').on(t.userId, t.mealId)],
);

/* ── water_logs — mutable base. Matches waterLogsTable. */
export const waterLogs = pgTable(
  'water_logs',
  {
    ...mutableBase,
    occurredAt: text('occurredAt').notNull(),
    localDate: text('localDate').notNull(),
    timezone: text('timezone').notNull(),
    millilitres: integer('millilitres').notNull(),
    source: text('source').notNull(),
    confidenceBps: integer('confidenceBps').notNull(),
    estimated: boolean('estimated').notNull(),
  },
  (t) => [index('water_logs_userId_localDate_idx').on(t.userId, t.localDate)],
);

/* ── workouts — mutable base. Matches workoutsTable. */
export const workouts = pgTable(
  'workouts',
  {
    ...mutableBase,
    occurredAt: text('occurredAt').notNull(),
    localDate: text('localDate').notNull(),
    timezone: text('timezone').notNull(),
    durationMinutes: integer('durationMinutes'),
    burnKcal: integer('burnKcal'),
    source: text('source').notNull(),
    confidenceBps: integer('confidenceBps').notNull(),
    estimated: boolean('estimated').notNull(),
    note: text('note'),
  },
  (t) => [index('workouts_userId_localDate_idx').on(t.userId, t.localDate)],
);

/* ── workout_exercises — mutable base. Matches workoutExercisesTable. */
export const workoutExercises = pgTable(
  'workout_exercises',
  {
    ...mutableBase,
    workoutId: text('workoutId').notNull(),
    name: text('name').notNull(),
    sets: integer('sets'),
    reps: integer('reps'),
    loadGrams: integer('loadGrams'),
    sortOrder: integer('sortOrder').notNull(),
  },
  (t) => [index('workout_exercises_userId_workoutId_sortOrder_idx').on(t.userId, t.workoutId, t.sortOrder)],
);

/* ── weigh_ins — mutable base. Matches weighInsTable. */
export const weighIns = pgTable(
  'weigh_ins',
  {
    ...mutableBase,
    occurredAt: text('occurredAt').notNull(),
    localDate: text('localDate').notNull(),
    timezone: text('timezone').notNull(),
    weightGrams: integer('weightGrams').notNull(),
    source: text('source').notNull(),
    confidenceBps: integer('confidenceBps').notNull(),
    estimated: boolean('estimated').notNull(),
  },
  (t) => [index('weigh_ins_userId_localDate_idx').on(t.userId, t.localDate)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * §4.5 HABITS AND SKILLS TABLES
 *   Targets and session values are integer minutes / counts.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── habits — mutable base. Matches habitsTable. */
export const habits = pgTable(
  'habits',
  {
    ...mutableBase,
    name: text('name').notNull(),
    cadence: text('cadence').notNull(),
    difficulty: text('difficulty').notNull(),
    targetValue: integer('targetValue'),
    targetUnit: text('targetUnit'),
    isArchived: boolean('isArchived').notNull(),
  },
  (t) => [uniqueIndex('habits_userId_name_uq').on(t.userId, t.name)],
);

/* ── habit_logs — mutable base. Matches habitLogsTable. */
export const habitLogs = pgTable(
  'habit_logs',
  {
    ...mutableBase,
    habitId: text('habitId').notNull(),
    occurredAt: text('occurredAt').notNull(),
    localDate: text('localDate').notNull(),
    timezone: text('timezone').notNull(),
    status: text('status').notNull(),
    source: text('source').notNull(),
    note: text('note'),
  },
  (t) => [
    uniqueIndex('habit_logs_userId_habitId_localDate_uq').on(t.userId, t.habitId, t.localDate),
    index('habit_logs_userId_localDate_idx').on(t.userId, t.localDate),
  ],
);

/* ── habit_satisfaction_rules — mutable base. Matches habitSatisfactionRulesTable. */
export const habitSatisfactionRules = pgTable(
  'habit_satisfaction_rules',
  {
    ...mutableBase,
    habitId: text('habitId').notNull(),
    sourceDomain: text('sourceDomain').notNull(),
    sourceKind: text('sourceKind').notNull(),
    aggregateField: text('aggregateField').notNull(),
    minimumValue: integer('minimumValue').notNull(),
    unit: text('unit'),
  },
  (t) => [
    uniqueIndex('habit_satisfaction_rules_userId_habitId_sourceDomain_sourceKind_aggregateField_uq').on(
      t.userId,
      t.habitId,
      t.sourceDomain,
      t.sourceKind,
      t.aggregateField,
    ),
  ],
);

/* ── skills — mutable base. Matches skillsTable. */
export const skills = pgTable(
  'skills',
  {
    ...mutableBase,
    name: text('name').notNull(),
    targetMinutes: integer('targetMinutes'),
    isArchived: boolean('isArchived').notNull(),
  },
  (t) => [uniqueIndex('skills_userId_name_uq').on(t.userId, t.name)],
);

/* ── skill_milestones — mutable base. Matches skillMilestonesTable. */
export const skillMilestones = pgTable(
  'skill_milestones',
  {
    ...mutableBase,
    skillId: text('skillId').notNull(),
    label: text('label').notNull(),
    sortOrder: integer('sortOrder').notNull(),
    completedAt: text('completedAt'),
  },
  (t) => [uniqueIndex('skill_milestones_userId_skillId_sortOrder_uq').on(t.userId, t.skillId, t.sortOrder)],
);

/* ── skill_sessions — mutable base. Matches skillSessionsTable. */
export const skillSessions = pgTable(
  'skill_sessions',
  {
    ...mutableBase,
    skillId: text('skillId').notNull(),
    occurredAt: text('occurredAt').notNull(),
    localDate: text('localDate').notNull(),
    timezone: text('timezone').notNull(),
    minutes: integer('minutes').notNull(),
    source: text('source').notNull(),
    note: text('note'),
    confidenceBps: integer('confidenceBps').notNull(),
    estimated: boolean('estimated').notNull(),
  },
  (t) => [index('skill_sessions_userId_skillId_localDate_idx').on(t.userId, t.skillId, t.localDate)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * §4.6 PLAN, PROGRESS, COACH, AND EVIDENCE TABLES
 *   JSON columns carry ONLY the named support shapes.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── plan_arcs — mutable base. Matches planArcsTable. */
export const planArcs = pgTable(
  'plan_arcs',
  {
    ...mutableBase,
    domain: text('domain').notNull(),
    mode: text('mode').notNull(),
    title: text('title').notNull(),
    startDate: text('startDate').notNull(),
    endDate: text('endDate'),
    dayNumber: integer('dayNumber').notNull(),
    status: text('status').notNull(),
  },
  (t) => [index('plan_arcs_userId_domain_status_idx').on(t.userId, t.domain, t.status)],
);

/* ── plan_items — mutable base. Matches planItemsTable. */
export const planItems = pgTable(
  'plan_items',
  {
    ...mutableBase,
    arcId: text('arcId').notNull(),
    domain: text('domain').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    dueAt: text('dueAt'),
    localDate: text('localDate').notNull(),
    targetValue: integer('targetValue'),
    targetUnit: text('targetUnit'),
    status: text('status').notNull(),
    completionSource: text('completionSource'),
    ruleJson: jsonb('ruleJson').$type<PlanRule>(),
    linkedHabitId: text('linkedHabitId'),
    linkedSkillId: text('linkedSkillId'),
  },
  (t) => [
    index('plan_items_userId_localDate_status_idx').on(t.userId, t.localDate, t.status),
    index('plan_items_userId_arcId_status_idx').on(t.userId, t.arcId, t.status),
  ],
);

/* ── domain_progress — mutable base. Matches domainProgressTable. */
export const domainProgress = pgTable(
  'domain_progress',
  {
    ...mutableBase,
    domain: text('domain').notNull(),
    xp: integer('xp').notNull(),
    level: integer('level').notNull(),
    streak: integer('streak').notNull(),
    bestStreak: integer('bestStreak').notNull(),
    cumulativeMinutes: integer('cumulativeMinutes').notNull(),
    lastActiveDate: text('lastActiveDate'),
  },
  (t) => [uniqueIndex('domain_progress_userId_domain_uq').on(t.userId, t.domain)],
);

/* ── day_one_snapshots — immutable base. Matches dayOneSnapshotsTable. */
export const dayOneSnapshots = pgTable(
  'day_one_snapshots',
  {
    ...immutableBase,
    domain: text('domain').notNull(),
    snapshotDate: text('snapshotDate').notNull(),
    statsJson: jsonb('statsJson').$type<DomainStatsSnapshot>().notNull(),
  },
  (t) => [uniqueIndex('day_one_snapshots_userId_domain_uq').on(t.userId, t.domain)],
);

/* ── coach_notes — immutable base. Matches coachNotesTable. */
export const coachNotes = pgTable(
  'coach_notes',
  {
    ...immutableBase,
    scope: text('scope').notNull(),
    localDate: text('localDate').notNull(),
    text: text('text').notNull(),
    modelProvider: text('modelProvider').notNull(),
    modelId: text('modelId').notNull(),
    evidenceJson: jsonb('evidenceJson').$type<CoachEvidence>().notNull(),
    stalenessKey: text('stalenessKey').notNull(),
  },
  (t) => [
    uniqueIndex('coach_notes_userId_scope_stalenessKey_uq').on(t.userId, t.scope, t.stalenessKey),
    index('coach_notes_userId_localDate_scope_idx').on(t.userId, t.localDate, t.scope),
  ],
);

/* ── adaptations — mutable base. Matches adaptationsTable. */
export const adaptations = pgTable(
  'adaptations',
  {
    ...mutableBase,
    planItemId: text('planItemId').notNull(),
    beforeJson: jsonb('beforeJson').$type<CommitRowSnapshot>().notNull(),
    afterJson: jsonb('afterJson').$type<CommitRowSnapshot>().notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull(),
    keptAt: text('keptAt'),
    revertedAt: text('revertedAt'),
  },
  (t) => [index('adaptations_userId_status_createdAt_idx').on(t.userId, t.status, t.createdAt)],
);

/* ── evidence — mutable base. Matches evidenceTable. */
export const evidence = pgTable(
  'evidence',
  {
    ...mutableBase,
    domain: text('domain').notNull(),
    entryKind: text('entryKind').notNull(),
    entryId: text('entryId'),
    storageProvider: text('storageProvider').notNull(),
    storagePath: text('storagePath').notNull(),
    mimeType: text('mimeType').notNull(),
    sha256: text('sha256').notNull(),
    caption: text('caption'),
    occurredAt: text('occurredAt').notNull(),
    localDate: text('localDate').notNull(),
  },
  (t) => [
    uniqueIndex('evidence_userId_sha256_uq').on(t.userId, t.sha256),
    index('evidence_userId_entryKind_entryId_idx').on(t.userId, t.entryKind, t.entryId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * §4.7 COMMIT/UNDO AND BILLING TABLES
 *   Commit + effect tables are immutable audit rows.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── commits — immutable base. Matches commitsTable. */
export const commits = pgTable(
  'commits',
  {
    ...immutableBase,
    draftId: text('draftId'),
    idempotencyKey: text('idempotencyKey').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    undoExpiresAt: text('undoExpiresAt').notNull(),
    undoneAt: text('undoneAt'),
    summary: text('summary').notNull(),
  },
  (t) => [
    uniqueIndex('commits_userId_idempotencyKey_uq').on(t.userId, t.idempotencyKey),
    index('commits_userId_status_createdAt_idx').on(t.userId, t.status, t.createdAt),
  ],
);

/* ── commit_rows — immutable base. Matches commitRowsTable. */
export const commitRows = pgTable(
  'commit_rows',
  {
    ...immutableBase,
    commitId: text('commitId').notNull(),
    entryKind: text('entryKind').notNull(),
    entryId: text('entryId').notNull(),
    operation: text('operation').notNull(),
    beforeJson: jsonb('beforeJson').$type<CommitRowSnapshot>(),
    afterJson: jsonb('afterJson').$type<CommitRowSnapshot>(),
  },
  (t) => [
    uniqueIndex('commit_rows_userId_commitId_entryKind_entryId_uq').on(
      t.userId,
      t.commitId,
      t.entryKind,
      t.entryId,
    ),
  ],
);

/* ── commit_progress_effects — immutable base. Matches commitProgressEffectsTable. */
export const commitProgressEffects = pgTable(
  'commit_progress_effects',
  {
    ...immutableBase,
    commitId: text('commitId').notNull(),
    domain: text('domain').notNull(),
    xpDelta: integer('xpDelta').notNull(),
    levelBefore: integer('levelBefore').notNull(),
    levelAfter: integer('levelAfter').notNull(),
    streakBefore: integer('streakBefore').notNull(),
    streakAfter: integer('streakAfter').notNull(),
    minutesDelta: integer('minutesDelta').notNull(),
  },
  (t) => [index('commit_progress_effects_userId_commitId_idx').on(t.userId, t.commitId)],
);

/* ── commit_plan_effects — immutable base. Matches commitPlanEffectsTable. */
export const commitPlanEffects = pgTable(
  'commit_plan_effects',
  {
    ...immutableBase,
    commitId: text('commitId').notNull(),
    planItemId: text('planItemId').notNull(),
    statusBefore: text('statusBefore').notNull(),
    statusAfter: text('statusAfter').notNull(),
    completionSourceBefore: text('completionSourceBefore'),
    completionSourceAfter: text('completionSourceAfter'),
  },
  (t) => [
    uniqueIndex('commit_plan_effects_userId_commitId_planItemId_uq').on(
      t.userId,
      t.commitId,
      t.planItemId,
    ),
  ],
);

/* ── checkout_sessions — mutable base. Matches checkoutSessionsTable. */
export const checkoutSessions = pgTable(
  'checkout_sessions',
  {
    ...mutableBase,
    provider: text('provider').notNull(),
    providerReceiptId: text('providerReceiptId').notNull(),
    amountPaise: integer('amountPaise').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    checkoutUrl: text('checkoutUrl'),
    expiresAt: text('expiresAt').notNull(),
  },
  (t) => [
    uniqueIndex('checkout_sessions_userId_providerReceiptId_uq').on(t.userId, t.providerReceiptId),
    index('checkout_sessions_userId_status_createdAt_idx').on(t.userId, t.status, t.createdAt),
  ],
);

/* ── billing_events — immutable base. Matches billingEventsTable.
 * Unique key is GLOBAL (provider, providerEventId) — intentionally excludes
 * userId for webhook-replay idempotency. Row still carries a non-null userId.
 */
export const billingEvents = pgTable(
  'billing_events',
  {
    ...immutableBase,
    provider: text('provider').notNull(),
    providerEventId: text('providerEventId').notNull(),
    eventType: text('eventType').notNull(),
    checkoutSessionId: text('checkoutSessionId'),
    paymentId: text('paymentId'),
    outcome: text('outcome').notNull(),
    payloadHash: text('payloadHash').notNull(),
    processedAt: text('processedAt'),
  },
  (t) => [
    uniqueIndex('billing_events_provider_providerEventId_uq').on(t.provider, t.providerEventId),
    index('billing_events_userId_createdAt_idx').on(t.userId, t.createdAt),
  ],
);

/* ── waitlist_requests — immutable base. Matches waitlistRequestsTable. */
export const waitlistRequests = pgTable(
  'waitlist_requests',
  {
    ...immutableBase,
    source: text('source').notNull(),
    requestedAt: text('requestedAt').notNull(),
  },
  (t) => [uniqueIndex('waitlist_requests_userId_source_uq').on(t.userId, t.source)],
);
