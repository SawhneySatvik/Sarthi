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
 * The 10 groups below wire all 33 tables. `S` builds a mutable per-domain
 * repository (full CRUD + soft delete); `A` builds an append-only/audit
 * repository (create/byId/list). Each call's four record/create/update/query
 * type parameters are inferred from the `UserScopedRepositories` target.
 */
import type {
  AuthenticatedUser,
  RepositoryFactory,
  UserScopedRepositories,
} from "@/core/contracts";
import { createSqliteDb, type SqliteDb } from "@/data/db/sqlite";
import {
  profiles,
  profileGaps,
  seedRuns,
  moneyCategories,
  transactions,
  recurringRules,
  budgets,
  meals,
  mealItems,
  waterLogs,
  workouts,
  workoutExercises,
  weighIns,
  habits,
  habitLogs,
  habitSatisfactionRules,
  skills,
  skillMilestones,
  skillSessions,
  planArcs,
  planItems,
  domainProgress,
  dayOneSnapshots,
  coachNotes,
  adaptations,
  evidence,
  commits,
  commitRows,
  commitProgressEffects,
  commitPlanEffects,
  checkoutSessions,
  billingEvents,
  waitlistRequests,
} from "@/data/schema/sqlite";

import {
  createScopedRepository as S,
  createAppendOnlyRepository as A,
} from "./base";
import { createCommitStateTransitions } from "./commits";
import { ScopeContext, runInTransaction } from "./scope";

/**
 * Assemble the 10 repository groups for one already-scoped request. All 33
 * tables are reachable through exactly one group; `userId` is injected only via
 * `ctx`. `transaction` swaps `ctx`'s executor to the tx handle for the duration
 * of `work` (see `runInTransaction`).
 */
export function assembleUserScopedRepositories(
  db: SqliteDb,
  ctx: ScopeContext,
): UserScopedRepositories {
  return {
    profile: {
      profiles: S("profiles", profiles, ctx),
      gaps: S("profile_gaps", profileGaps, ctx),
      seedRuns: A("seed_runs", seedRuns, ctx),
    },
    money: {
      categories: S("money_categories", moneyCategories, ctx),
      transactions: S("transactions", transactions, ctx),
      recurringRules: S("recurring_rules", recurringRules, ctx),
      budgets: S("budgets", budgets, ctx),
    },
    health: {
      meals: S("meals", meals, ctx),
      mealItems: S("meal_items", mealItems, ctx),
      waterLogs: S("water_logs", waterLogs, ctx),
      workouts: S("workouts", workouts, ctx),
      workoutExercises: S("workout_exercises", workoutExercises, ctx),
      weighIns: S("weigh_ins", weighIns, ctx),
    },
    habits: {
      habits: S("habits", habits, ctx),
      logs: S("habit_logs", habitLogs, ctx),
      satisfactionRules: S("habit_satisfaction_rules", habitSatisfactionRules, ctx),
    },
    skills: {
      skills: S("skills", skills, ctx),
      milestones: S("skill_milestones", skillMilestones, ctx),
      sessions: S("skill_sessions", skillSessions, ctx),
    },
    plans: {
      arcs: S("plan_arcs", planArcs, ctx),
      items: S("plan_items", planItems, ctx),
      progress: S("domain_progress", domainProgress, ctx),
      dayOneSnapshots: A("day_one_snapshots", dayOneSnapshots, ctx),
    },
    coach: {
      notes: A("coach_notes", coachNotes, ctx),
      adaptations: S("adaptations", adaptations, ctx),
    },
    evidence: S("evidence", evidence, ctx),
    commits: {
      commits: A("commits", commits, ctx),
      rows: A("commit_rows", commitRows, ctx),
      progressEffects: A("commit_progress_effects", commitProgressEffects, ctx),
      planEffects: A("commit_plan_effects", commitPlanEffects, ctx),
      ...createCommitStateTransitions(ctx),
    },
    billing: {
      checkoutSessions: S("checkout_sessions", checkoutSessions, ctx),
      events: A("billing_events", billingEvents, ctx),
      waitlist: A("waitlist_requests", waitlistRequests, ctx),
    },
    transaction<T>(work: () => Promise<T>): Promise<T> {
      return runInTransaction(db, ctx, work);
    },
  };
}

/**
 * Build a `RepositoryFactory` over a shared db connection. `forUser` creates a
 * fresh per-request `ScopeContext` from the verified identity — the scope is
 * never reused across users; only the underlying connection is shared.
 */
export function createRepositoryFactory(db: SqliteDb): RepositoryFactory {
  return {
    forUser(user: AuthenticatedUser): UserScopedRepositories {
      const ctx = new ScopeContext(user.userId, db);
      return assembleUserScopedRepositories(db, ctx);
    },
  };
}

/** Convenience composition root: open a SQLite db at `url` and wrap it. */
export function createSqliteRepositoryFactory(url: string): RepositoryFactory {
  return createRepositoryFactory(createSqliteDb(url));
}
