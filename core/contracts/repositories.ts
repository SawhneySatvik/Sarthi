/**
 * Framework-clean repository contracts. Business logic depends only on these ports;
 * the Drizzle impl (later step) satisfies them over SQLite (dev) and Postgres (prod).
 *
 * HARD boundary: never import `drizzle-orm` here — not even `import type`. Only the
 * drizzle-free `@/data/schema/contract` DTO types may cross into core.
 */
import type {
  ProfileRecord,
  ProfileCreate,
  ProfileUpdate,
  ProfileQuery,
  ProfileGapRecord,
  ProfileGapCreate,
  ProfileGapUpdate,
  ProfileGapQuery,
  SeedRunRecord,
  SeedRunCreate,
  SeedRunQuery,
  MoneyCategoryRecord,
  MoneyCategoryCreate,
  MoneyCategoryUpdate,
  MoneyCategoryQuery,
  TransactionRecord,
  TransactionCreate,
  TransactionUpdate,
  TransactionQuery,
  RecurringRuleRecord,
  RecurringRuleCreate,
  RecurringRuleUpdate,
  RecurringRuleQuery,
  BudgetRecord,
  BudgetCreate,
  BudgetUpdate,
  BudgetQuery,
  MealRecord,
  MealCreate,
  MealUpdate,
  MealQuery,
  MealItemRecord,
  MealItemCreate,
  MealItemUpdate,
  MealItemQuery,
  WaterLogRecord,
  WaterLogCreate,
  WaterLogUpdate,
  WaterLogQuery,
  WorkoutRecord,
  WorkoutCreate,
  WorkoutUpdate,
  WorkoutQuery,
  WorkoutExerciseRecord,
  WorkoutExerciseCreate,
  WorkoutExerciseUpdate,
  WorkoutExerciseQuery,
  WeighInRecord,
  WeighInCreate,
  WeighInUpdate,
  WeighInQuery,
  HabitRecord,
  HabitCreate,
  HabitUpdate,
  HabitQuery,
  HabitLogRecord,
  HabitLogCreate,
  HabitLogUpdate,
  HabitLogQuery,
  HabitSatisfactionRuleRecord,
  HabitSatisfactionRuleCreate,
  HabitSatisfactionRuleUpdate,
  HabitSatisfactionRuleQuery,
  SkillRecord,
  SkillCreate,
  SkillUpdate,
  SkillQuery,
  SkillMilestoneRecord,
  SkillMilestoneCreate,
  SkillMilestoneUpdate,
  SkillMilestoneQuery,
  SkillSessionRecord,
  SkillSessionCreate,
  SkillSessionUpdate,
  SkillSessionQuery,
  PlanArcRecord,
  PlanArcCreate,
  PlanArcUpdate,
  PlanArcQuery,
  PlanItemRecord,
  PlanItemCreate,
  PlanItemUpdate,
  PlanItemQuery,
  DomainProgressRecord,
  DomainProgressCreate,
  DomainProgressUpdate,
  DomainProgressQuery,
  DayOneSnapshotRecord,
  DayOneSnapshotCreate,
  DayOneSnapshotQuery,
  CoachNoteRecord,
  CoachNoteCreate,
  CoachNoteQuery,
  AdaptationRecord,
  AdaptationCreate,
  AdaptationUpdate,
  AdaptationQuery,
  EvidenceRecord,
  EvidenceCreate,
  EvidenceUpdate,
  EvidenceQuery,
  CommitRecord,
  CommitCreate,
  CommitQuery,
  CommitRowRecord,
  CommitRowCreate,
  CommitRowQuery,
  CommitProgressEffectRecord,
  CommitProgressEffectCreate,
  CommitProgressEffectQuery,
  CommitPlanEffectRecord,
  CommitPlanEffectCreate,
  CommitPlanEffectQuery,
  CheckoutSessionRecord,
  CheckoutSessionCreate,
  CheckoutSessionUpdate,
  CheckoutSessionQuery,
  BillingEventRecord,
  BillingEventCreate,
  BillingEventQuery,
  WaitlistRequestRecord,
  WaitlistRequestCreate,
  WaitlistRequestQuery,
} from "@/data/schema/contract";

/** The verified identity a request runs as. No repository method accepts a caller-supplied `userId`. */
export interface AuthenticatedUser {
  userId: string;
  email: string | null;
  mode: "local" | "supabase";
}

/**
 * Mutable per-domain table port: full CRUD plus soft delete.
 *
 * `create`/`list` never accept a caller-supplied `userId` (SAR-003): the tenant is
 * injected from the verified `AuthenticatedUser` scope inside the impl, so it is
 * `Omit`-ed off the port input. `update`'s `TUpdate` is a business-field partial
 * with no identity columns, so it needs no narrowing.
 */
export interface ScopedEntityRepository<TRecord, TCreate, TUpdate, TQuery> {
  create(input: Omit<TCreate, "userId">): Promise<TRecord>;
  byId(id: string): Promise<TRecord | null>;
  list(query: Omit<TQuery, "userId">): Promise<readonly TRecord[]>;
  update(id: string, patch: TUpdate): Promise<TRecord>;
  softDelete(id: string): Promise<void>;
}

/**
 * Immutable/audit table port: rows are append-only. No `update`, no `softDelete` —
 * audit history is never fabricated or mutated after the fact. As with the scoped
 * port, `create`/`list` never accept a caller-supplied `userId` (SAR-003).
 */
export interface AppendOnlyRepository<TRecord, TCreate, TQuery> {
  create(input: Omit<TCreate, "userId">): Promise<TRecord>;
  byId(id: string): Promise<TRecord | null>;
  list(query: Omit<TQuery, "userId">): Promise<readonly TRecord[]>;
}

export interface ProfileRepository {
  profiles: ScopedEntityRepository<ProfileRecord, ProfileCreate, ProfileUpdate, ProfileQuery>;
  gaps: ScopedEntityRepository<ProfileGapRecord, ProfileGapCreate, ProfileGapUpdate, ProfileGapQuery>;
  seedRuns: AppendOnlyRepository<SeedRunRecord, SeedRunCreate, SeedRunQuery>;
}

export interface MoneyRepositories {
  categories: ScopedEntityRepository<MoneyCategoryRecord, MoneyCategoryCreate, MoneyCategoryUpdate, MoneyCategoryQuery>;
  transactions: ScopedEntityRepository<TransactionRecord, TransactionCreate, TransactionUpdate, TransactionQuery>;
  recurringRules: ScopedEntityRepository<RecurringRuleRecord, RecurringRuleCreate, RecurringRuleUpdate, RecurringRuleQuery>;
  budgets: ScopedEntityRepository<BudgetRecord, BudgetCreate, BudgetUpdate, BudgetQuery>;
}

export interface HealthRepositories {
  meals: ScopedEntityRepository<MealRecord, MealCreate, MealUpdate, MealQuery>;
  mealItems: ScopedEntityRepository<MealItemRecord, MealItemCreate, MealItemUpdate, MealItemQuery>;
  waterLogs: ScopedEntityRepository<WaterLogRecord, WaterLogCreate, WaterLogUpdate, WaterLogQuery>;
  workouts: ScopedEntityRepository<WorkoutRecord, WorkoutCreate, WorkoutUpdate, WorkoutQuery>;
  workoutExercises: ScopedEntityRepository<WorkoutExerciseRecord, WorkoutExerciseCreate, WorkoutExerciseUpdate, WorkoutExerciseQuery>;
  weighIns: ScopedEntityRepository<WeighInRecord, WeighInCreate, WeighInUpdate, WeighInQuery>;
}

export interface HabitRepositories {
  habits: ScopedEntityRepository<HabitRecord, HabitCreate, HabitUpdate, HabitQuery>;
  logs: ScopedEntityRepository<HabitLogRecord, HabitLogCreate, HabitLogUpdate, HabitLogQuery>;
  satisfactionRules: ScopedEntityRepository<HabitSatisfactionRuleRecord, HabitSatisfactionRuleCreate, HabitSatisfactionRuleUpdate, HabitSatisfactionRuleQuery>;
}

export interface SkillRepositories {
  skills: ScopedEntityRepository<SkillRecord, SkillCreate, SkillUpdate, SkillQuery>;
  milestones: ScopedEntityRepository<SkillMilestoneRecord, SkillMilestoneCreate, SkillMilestoneUpdate, SkillMilestoneQuery>;
  sessions: ScopedEntityRepository<SkillSessionRecord, SkillSessionCreate, SkillSessionUpdate, SkillSessionQuery>;
}

export interface PlanRepositories {
  arcs: ScopedEntityRepository<PlanArcRecord, PlanArcCreate, PlanArcUpdate, PlanArcQuery>;
  items: ScopedEntityRepository<PlanItemRecord, PlanItemCreate, PlanItemUpdate, PlanItemQuery>;
  progress: ScopedEntityRepository<DomainProgressRecord, DomainProgressCreate, DomainProgressUpdate, DomainProgressQuery>;
  dayOneSnapshots: AppendOnlyRepository<DayOneSnapshotRecord, DayOneSnapshotCreate, DayOneSnapshotQuery>;
}

export interface CoachRepositories {
  notes: AppendOnlyRepository<CoachNoteRecord, CoachNoteCreate, CoachNoteQuery>;
  adaptations: ScopedEntityRepository<AdaptationRecord, AdaptationCreate, AdaptationUpdate, AdaptationQuery>;
}

/** Evidence is a single table, so its repository is the scoped repo directly. */
export type EvidenceRepository = ScopedEntityRepository<EvidenceRecord, EvidenceCreate, EvidenceUpdate, EvidenceQuery>;

export interface CommitRepository {
  commits: AppendOnlyRepository<CommitRecord, CommitCreate, CommitQuery>;
  rows: AppendOnlyRepository<CommitRowRecord, CommitRowCreate, CommitRowQuery>;
  progressEffects: AppendOnlyRepository<CommitProgressEffectRecord, CommitProgressEffectCreate, CommitProgressEffectQuery>;
  planEffects: AppendOnlyRepository<CommitPlanEffectRecord, CommitPlanEffectCreate, CommitPlanEffectQuery>;
  /**
   * Guarded audit-state transitions (D-E / NB-4). The commit envelope's lifecycle
   * `status` was always designed to move (`committed` → `undone` | `superseded`);
   * these are the ONLY mutations the audit group permits, and they touch only the
   * envelope status (+ `undoneAt`) — never the business payload, and never the
   * append-only ledgers (`rows`/`progressEffects`/`planEffects`). Both transition
   * only from `status: 'committed'`; any other from-state (or a foreign/absent id)
   * throws `RepositoryError`.
   */
  markUndone(commitId: string, undoneAt: string): Promise<CommitRecord>;
  markSuperseded(commitId: string): Promise<CommitRecord>;
}

export interface BillingRepository {
  checkoutSessions: ScopedEntityRepository<CheckoutSessionRecord, CheckoutSessionCreate, CheckoutSessionUpdate, CheckoutSessionQuery>;
  events: AppendOnlyRepository<BillingEventRecord, BillingEventCreate, BillingEventQuery>;
  waitlist: AppendOnlyRepository<WaitlistRequestRecord, WaitlistRequestCreate, WaitlistRequestQuery>;
}

/** The full per-user repository surface, obtained via `RepositoryFactory.forUser`. */
export interface UserScopedRepositories {
  profile: ProfileRepository;
  money: MoneyRepositories;
  health: HealthRepositories;
  habits: HabitRepositories;
  skills: SkillRepositories;
  plans: PlanRepositories;
  coach: CoachRepositories;
  evidence: EvidenceRepository;
  commits: CommitRepository;
  billing: BillingRepository;
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export interface RepositoryFactory {
  forUser(user: AuthenticatedUser): UserScopedRepositories;
}
