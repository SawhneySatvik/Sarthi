/**
 * data/repository/factory.ts — the composition root that assembles the full
 * per-user repository surface from the descriptor-driven primitives.
 *
 * `createRepositoryFactory` owns a single shared db connection. Every
 * `forUser` call mints a FRESH `ScopeContext` bound to that user's `userId` —
 * the connection is shared across requests, the tenant scope never is. Because
 * `userId` lives only on the `ScopeContext` (constructed here from the verified
 * `AuthenticatedUser`), no repository method can be handed another tenant's id.
 *
 * DUAL DIALECT: the assembly is parameterized by a `SchemaTables` bundle. The
 * SQLite path passes `sqliteSchema` (dev/CI, keyless); the Postgres path passes
 * `postgresSchema` (prod / Supabase). The repository primitives (base.ts) are
 * typed against the SQLite executor but their query LOGIC is dialect-agnostic —
 * the ORM-boundary casts stay confined to base.ts's run helpers, and the pg
 * composition root casts db + tables ONLY at this boundary. At runtime every
 * table object handed to the ORM matches the active executor's dialect.
 *
 * The 10 groups below wire all 35 tables. `S` builds a mutable per-domain
 * repository (full CRUD + soft delete); `A` builds an append-only/audit
 * repository (create/byId/list).
 */
import type {
  AuthenticatedUser,
  RepositoryFactory,
  UserScopedRepositories,
} from "@/core/contracts";
import { createPostgresDb } from "@/data/db/postgres";
import { createSqliteDb, type SqliteDb } from "@/data/db/sqlite";
import * as sqliteSchema from "@/data/schema/sqlite";
import * as postgresSchema from "@/data/schema/postgres";

import {
  createScopedRepository as S,
  createAppendOnlyRepository as A,
} from "./base";
import { createCommitStateTransitions } from "./commits";
import { ScopeContext, runInTransaction } from "./scope";

/**
 * The bundle of table handles the assembly consumes. Both dialect modules
 * (`schema/sqlite.ts`, `schema/postgres.ts`) export these names identically —
 * `schema/contract.ts` is the shared source of truth — so the pg module casts
 * cleanly onto this SQLite-typed shape at the composition boundary.
 */
type SchemaTables = typeof sqliteSchema;

/**
 * Assemble the 10 repository groups for one already-scoped request. All 35
 * tables are reachable through exactly one group; `userId` is injected only via
 * `ctx`. `transaction` swaps `ctx`'s executor to the tx handle for the duration
 * of `work` (see `runInTransaction`). `t` selects the dialect's table objects.
 */
export function assembleUserScopedRepositories(
  db: SqliteDb,
  ctx: ScopeContext,
  t: SchemaTables = sqliteSchema,
): UserScopedRepositories {
  return {
    profile: {
      profiles: S("profiles", t.profiles, ctx),
      gaps: S("profile_gaps", t.profileGaps, ctx),
      seedRuns: A("seed_runs", t.seedRuns, ctx),
    },
    money: {
      categories: S("money_categories", t.moneyCategories, ctx),
      transactions: S("transactions", t.transactions, ctx),
      recurringRules: S("recurring_rules", t.recurringRules, ctx),
      budgets: S("budgets", t.budgets, ctx),
    },
    health: {
      meals: S("meals", t.meals, ctx),
      mealItems: S("meal_items", t.mealItems, ctx),
      waterLogs: S("water_logs", t.waterLogs, ctx),
      workouts: S("workouts", t.workouts, ctx),
      workoutExercises: S("workout_exercises", t.workoutExercises, ctx),
      weighIns: S("weigh_ins", t.weighIns, ctx),
    },
    habits: {
      habits: S("habits", t.habits, ctx),
      logs: S("habit_logs", t.habitLogs, ctx),
      satisfactionRules: S("habit_satisfaction_rules", t.habitSatisfactionRules, ctx),
    },
    skills: {
      skills: S("skills", t.skills, ctx),
      milestones: S("skill_milestones", t.skillMilestones, ctx),
      sessions: S("skill_sessions", t.skillSessions, ctx),
    },
    plans: {
      arcs: S("plan_arcs", t.planArcs, ctx),
      items: S("plan_items", t.planItems, ctx),
      progress: S("domain_progress", t.domainProgress, ctx),
      dayOneSnapshots: A("day_one_snapshots", t.dayOneSnapshots, ctx),
    },
    coach: {
      notes: A("coach_notes", t.coachNotes, ctx),
      adaptations: S("adaptations", t.adaptations, ctx),
    },
    evidence: S("evidence", t.evidence, ctx),
    journey: {
      reflections: S("daily_reflections", t.dailyReflections, ctx),
      media: S("reflection_media", t.reflectionMedia, ctx),
    },
    commits: {
      commits: A("commits", t.commits, ctx),
      rows: A("commit_rows", t.commitRows, ctx),
      progressEffects: A("commit_progress_effects", t.commitProgressEffects, ctx),
      planEffects: A("commit_plan_effects", t.commitPlanEffects, ctx),
      ...createCommitStateTransitions(ctx, t.commits),
    },
    billing: {
      checkoutSessions: S("checkout_sessions", t.checkoutSessions, ctx),
      events: A("billing_events", t.billingEvents, ctx),
      waitlist: A("waitlist", t.waitlist, ctx),
    },
    transaction<T>(work: () => Promise<T>): Promise<T> {
      return runInTransaction(db, ctx, work);
    },
  };
}

/**
 * Build a `RepositoryFactory` over a shared db connection. `forUser` creates a
 * fresh per-request `ScopeContext` from the verified identity — the scope is
 * never reused across users; only the underlying connection is shared. `tables`
 * selects the dialect (defaults to SQLite).
 */
export function createRepositoryFactory(
  db: SqliteDb,
  tables: SchemaTables = sqliteSchema,
): RepositoryFactory {
  return {
    forUser(user: AuthenticatedUser): UserScopedRepositories {
      const ctx = new ScopeContext(user.userId, db);
      return assembleUserScopedRepositories(db, ctx, tables);
    },
  };
}

/** Convenience composition root: open a libSQL db at `url` and wrap it. */
export function createSqliteRepositoryFactory(url: string, authToken?: string): RepositoryFactory {
  return createRepositoryFactory(createSqliteDb(url, authToken));
}

/**
 * Convenience composition root for Postgres (prod / Supabase). Binds the SAME
 * dialect-agnostic assembly to the Postgres db + Postgres tables. The two casts
 * are the ONLY dialect casts and live exactly here at the boundary: `base.ts`
 * keeps its ORM-boundary casts, and at runtime the pg executor runs pg tables.
 */
export function createPostgresRepositoryFactory(url: string): RepositoryFactory {
  const db = createPostgresDb(url) as unknown as SqliteDb;
  return createRepositoryFactory(db, postgresSchema as unknown as SchemaTables);
}
