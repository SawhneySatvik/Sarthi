import { RepositoryError } from "@contracts";
import type {
  AppendOnlyRepository,
  AuthenticatedUser,
  CommitRepository,
  RepositoryFactory,
  ScopedEntityRepository,
  UserScopedRepositories,
} from "@contracts";
import { decodeRow, encodeRow } from "@mobile/db/codec";
import type { LocalRepositoryStorage } from "@mobile/db/types";
import type { CommitRecord } from "@schema/contract";

import { RepositoryChangeStore } from "./changes";
import { createAppendOnlyRepository, createScopedRepository } from "./base";
import { ConfirmedCommitOutbox } from "./outbox";
import { NativeRepositoryScope } from "./scope";

type Scoped = ScopedEntityRepository<never, never, never, never>;
type AppendOnly = AppendOnlyRepository<never, never, never>;

export interface MobileRepositoryFactoryOptions {
  /** Runtime supplies the foundation's node:crypto shim; tests use Web Crypto. */
  createId?: () => string;
}

function webCryptoId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (!randomUUID) throw new Error("A UUID implementation is required for native repositories");
  return randomUUID.call(globalThis.crypto);
}

const scoped = (table: Parameters<typeof createScopedRepository>[0], scope: NativeRepositoryScope): Scoped =>
  createScopedRepository(table, scope) as Scoped;
const appendOnly = (table: Parameters<typeof createAppendOnlyRepository>[0], scope: NativeRepositoryScope): AppendOnly =>
  createAppendOnlyRepository(table, scope) as AppendOnly;

function commitTransitions(scope: NativeRepositoryScope): Pick<CommitRepository, "markUndone" | "markSuperseded"> {
  const transition = async (
    commitId: string,
    patch: Record<string, unknown>,
  ): Promise<CommitRecord> => {
    const rows = await scope.storage.select("commits", [
      { column: "id", value: commitId },
      { column: "userId", value: scope.userId },
      { column: "status", value: "committed" },
    ]);
    if (rows.length !== 1) {
      throw new RepositoryError(`commits ${commitId}: not found, not owned, or not in 'committed' state`);
    }
    const changed = await scope.storage.update(
      "commits",
      [
        { column: "id", value: commitId },
        { column: "userId", value: scope.userId },
        { column: "status", value: "committed" },
      ],
      encodeRow("commits", patch),
    );
    if (changed !== 1) {
      throw new RepositoryError(`commits ${commitId}: transition did not complete`);
    }
    const after = await scope.storage.select("commits", [
      { column: "id", value: commitId },
      { column: "userId", value: scope.userId },
    ]);
    const record = after[0];
    if (!record) throw new RepositoryError(`commits ${commitId}: transition lost its row`);
    await scope.record({ table: "commits", id: commitId, operation: "update" });
    return decodeRow<CommitRecord>("commits", record);
  };

  return {
    markUndone: (commitId, undoneAt) => transition(commitId, { status: "undone", undoneAt }),
    markSuperseded: (commitId) => transition(commitId, { status: "superseded" }),
  };
}

/**
 * The mobile implementation of the immutable core RepositoryFactory port. A
 * user scope is always new; only the durable SQLite connection is shared.
 */
export class MobileRepositoryFactory implements RepositoryFactory {
  readonly changes: RepositoryChangeStore;
  readonly outbox: ConfirmedCommitOutbox;
  private readonly createId: () => string;

  constructor(private readonly storage: LocalRepositoryStorage, options: MobileRepositoryFactoryOptions = {}) {
    this.createId = options.createId ?? webCryptoId;
    this.changes = new RepositoryChangeStore(storage);
    this.outbox = new ConfirmedCommitOutbox(storage, this.createId);
  }

  forUser(user: AuthenticatedUser): UserScopedRepositories {
    const scope = new NativeRepositoryScope(
      user.userId,
      this.storage,
      this.changes,
      this.outbox,
      this.createId,
    );
    return {
      profile: {
        profiles: scoped("profiles", scope),
        gaps: scoped("profile_gaps", scope),
        seedRuns: appendOnly("seed_runs", scope),
      },
      money: {
        categories: scoped("money_categories", scope),
        transactions: scoped("transactions", scope),
        recurringRules: scoped("recurring_rules", scope),
        budgets: scoped("budgets", scope),
      },
      health: {
        meals: scoped("meals", scope),
        mealItems: scoped("meal_items", scope),
        waterLogs: scoped("water_logs", scope),
        workouts: scoped("workouts", scope),
        workoutExercises: scoped("workout_exercises", scope),
        weighIns: scoped("weigh_ins", scope),
      },
      habits: {
        habits: scoped("habits", scope),
        logs: scoped("habit_logs", scope),
        satisfactionRules: scoped("habit_satisfaction_rules", scope),
      },
      skills: {
        skills: scoped("skills", scope),
        milestones: scoped("skill_milestones", scope),
        sessions: scoped("skill_sessions", scope),
      },
      plans: {
        arcs: scoped("plan_arcs", scope),
        items: scoped("plan_items", scope),
        progress: scoped("domain_progress", scope),
        dayOneSnapshots: appendOnly("day_one_snapshots", scope),
      },
      coach: {
        notes: appendOnly("coach_notes", scope),
        adaptations: scoped("adaptations", scope),
      },
      evidence: scoped("evidence", scope),
      journey: {
        reflections: scoped("daily_reflections", scope),
        media: scoped("reflection_media", scope),
      },
      commits: {
        commits: appendOnly("commits", scope),
        rows: appendOnly("commit_rows", scope),
        progressEffects: appendOnly("commit_progress_effects", scope),
        planEffects: appendOnly("commit_plan_effects", scope),
        ...commitTransitions(scope),
      },
      billing: {
        checkoutSessions: scoped("checkout_sessions", scope),
        events: appendOnly("billing_events", scope),
        waitlist: appendOnly("waitlist", scope),
      },
      transaction: <T>(work: () => Promise<T>) => scope.transaction(work),
    } as UserScopedRepositories;
  }
}
