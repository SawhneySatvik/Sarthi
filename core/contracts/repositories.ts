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
  CoachMessageRecord,
  CoachMessageCreate,
  CoachMessageQuery,
  CoachMemoryRecord,
  CoachMemoryCreate,
  CoachMemoryUpdate,
  CoachMemoryQuery,
  CoachMemoryAuditRecord,
  CoachMemoryAuditCreate,
  CoachMemoryAuditQuery,
  AdaptationRecord,
  AdaptationCreate,
  AdaptationUpdate,
  AdaptationQuery,
  EvidenceRecord,
  EvidenceCreate,
  EvidenceUpdate,
  EvidenceQuery,
  DailyReflectionRecord,
  DailyReflectionCreate,
  DailyReflectionUpdate,
  DailyReflectionQuery,
  ReflectionMediaRecord,
  ReflectionMediaCreate,
  ReflectionMediaUpdate,
  ReflectionMediaQuery,
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
  WaitlistRecord,
  WaitlistCreate,
  WaitlistQuery,
  WaitlistStatus,
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

/**
 * Durable distilled memory (COACH-1, Layer 2). NOT a `ScopedEntityRepository`:
 * its content (`text`/`kind`/`domain`) is immutable post-create, and it is
 * retired — never deleted — so it exposes create/byId/list plus a BOUNDED
 * lifecycle update (`pinned`/`useCount`/`lastUsedAt`/`retired` only, invariant #6),
 * and no `softDelete`. `create`/`list` never accept a caller-supplied `userId`.
 */
export interface CoachMemoryRepository {
  create(input: Omit<CoachMemoryCreate, "userId">): Promise<CoachMemoryRecord>;
  byId(id: string): Promise<CoachMemoryRecord | null>;
  list(query: Omit<CoachMemoryQuery, "userId">): Promise<readonly CoachMemoryRecord[]>;
  /** Bounded lifecycle/bookkeeping update — pinned/useCount/lastUsedAt/retired only. */
  update(id: string, patch: CoachMemoryUpdate): Promise<CoachMemoryRecord>;
}

export interface CoachRepositories {
  notes: AppendOnlyRepository<CoachNoteRecord, CoachNoteCreate, CoachNoteQuery>;
  adaptations: ScopedEntityRepository<AdaptationRecord, AdaptationCreate, AdaptationUpdate, AdaptationQuery>;
  /** Layer 1 raw turn buffer — append + query only. */
  messages: AppendOnlyRepository<CoachMessageRecord, CoachMessageCreate, CoachMessageQuery>;
  /** Layer 2 durable distilled memory — create + bounded update + list. */
  memory: CoachMemoryRepository;
  /** Append-only provenance ledger for every coach_memory state change. */
  memoryAudit: AppendOnlyRepository<CoachMemoryAuditRecord, CoachMemoryAuditCreate, CoachMemoryAuditQuery>;
}

/** Evidence is a single table, so its repository is the scoped repo directly. */
export type EvidenceRepository = ScopedEntityRepository<EvidenceRecord, EvidenceCreate, EvidenceUpdate, EvidenceQuery>;

export interface JourneyRepositories {
  reflections: ScopedEntityRepository<DailyReflectionRecord, DailyReflectionCreate, DailyReflectionUpdate, DailyReflectionQuery>;
  media: ScopedEntityRepository<ReflectionMediaRecord, ReflectionMediaCreate, ReflectionMediaUpdate, ReflectionMediaQuery>;
}

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
  waitlist: AppendOnlyRepository<WaitlistRecord, WaitlistCreate, WaitlistQuery>;
}

/**
 * Admin-only, DELIBERATELY UNSCOPED waitlist access (PL-2). The waitlist is a global
 * email list — `userId` is metadata, never a tenant key — so approving/inviting emails
 * requires enumerating ALL rows, which the per-tenant `AppendOnlyRepository` above cannot
 * do. This port is the explicit seam for that: it is NOT reachable through
 * `RepositoryFactory.forUser`, and its only production caller (`app/lib/admin.ts`) hands
 * it out ONLY after an authenticated + allowlisted admin gate. Business logic still goes
 * through this repository (typed methods, no raw SQL in routes — invariant #5); the seam is
 * the absence of tenant scoping, not the absence of the repository layer.
 */
export interface AdminWaitlistRepository {
  /** Every waitlist row, most-recent first. Unscoped by design (admin enumeration). */
  listAll(): Promise<readonly WaitlistRecord[]>;
  /** The lifecycle status of one email (normalized lower/trim), or null if not on the list. */
  statusForEmail(email: string): Promise<WaitlistStatus | null>;
  /** Move one row (by id) to a new lifecycle status. Throws if the id is unknown. */
  updateStatus(id: string, status: WaitlistStatus): Promise<WaitlistRecord>;
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
  journey: JourneyRepositories;
  commits: CommitRepository;
  billing: BillingRepository;
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export interface RepositoryFactory {
  forUser(user: AuthenticatedUser): UserScopedRepositories;
}
