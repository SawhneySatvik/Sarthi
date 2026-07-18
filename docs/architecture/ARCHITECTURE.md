# ARCHITECTURE.md — Signed Build Blueprint

| | |
|---|---|
| **Status** | Stage 3 architecture gate — locked by Satvik on 2026-07-17 |
| **Authority** | Implements `docs/product/DECISIONS.md` D-001–D-036 and supersedes the interface sketches in `TECH-STACK.md` where more specific |
| **Build rule** | Terra writes application code only from an approved ticket derived from this document |
| **Non-negotiable gates** | F3 is keyless on fake + SQLite; wrong silent writes = zero; all persistent user rows are tenant-scoped |

## 1. Module graph and dependency rules

```text
app routes / server actions / UI components
        │ authenticate, validate HTTP, serialize DTOs
        ▼
composition root (app/lib/runtime.ts)
        ├── providers/*       real or fake adapters selected by env
        ├── data/*            Drizzle drivers, schemas, repository implementations
        ▼
core/*                        framework-clean use cases and contracts
        ├── capture            parse → route → commit → undo
        ├── coach              registry-driven coach engine
        ├── domains            typed proposal dispatch + plan effects
        └── game               deterministic XP/level/streak calculations
```

- `core/` imports only TypeScript/standard-library utilities, Zod, and contracts in `core/contracts/`; it never imports React, Next.js, route handlers, Drizzle, Supabase, or concrete AI SDK providers.
- `providers/` implements `core/contracts/*Provider`; `data/` implements `core/contracts/repositories`.
- `app/` is the only layer that knows cookies, headers, `FormData`, server actions, and UI DTOs.
- `components/` call typed app endpoints/actions only. They never call a provider or database driver.
- `scripts/check-core-boundary.mjs` is required in `pnpm check:core-boundary` and CI. It fails if `core/**/*.{ts,tsx}` imports `next`, `react`, `drizzle-orm`, `@supabase/*`, `@ai-sdk/*`, or `providers/*` concrete adapters.

### 1.1 Concrete layout

```text
app/
  (public)/                 landing, pricing, privacy, terms
  (auth)/                   signup, login, reset-password
  (app)/                    today, journey, coach, stats, tools, settings
  api/capture/parse         authenticated parse endpoint
  api/capture/commit        authenticated commit/undo endpoint
  api/coach/*               brief, ask, adaptation endpoints
  api/billing/checkout      authenticated Razorpay checkout creation
  api/billing/webhook       raw-body signed Razorpay webhook
core/
  contracts/                providers, repositories, DTOs, errors
  capture/                  draft schema, routing, commit service, undo service
  coach/                    engine, DomainSpec registry, tool contracts
  domains/                  health, money, habits, skills typed dispatchers
  game/                     pure XP, level, streak, mastery, plan-effect functions
providers/
  llm/ voice/ vision/ auth/ billing/ fake/
data/
  schema/contract.ts        closed table/type contract shared by both dialects
  schema/sqlite.ts          Drizzle SQLite declarations
  schema/postgres.ts        Drizzle Postgres declarations
  repository/               one user-scoped implementation over a dialect adapter
  db/sqlite.ts db/postgres.ts migrations/
eval/
  fixtures/ cases/ report.ts
scripts/
  check-core-boundary.mjs
```

## 2. Runtime configuration and model matrix

```ts
export type LlmProviderName = 'fake' | 'google' | 'openai' | 'anthropic';
export type VoiceProviderName = 'fake' | 'gemini' | 'sarvam' | 'openai' | 'webspeech';
export type VisionProviderName = 'fake' | 'google' | 'openai';
export type AuthProviderName = 'local-password' | 'supabase';
export type DatabaseProviderName = 'sqlite' | 'postgres';
export type Tier = 'deep' | 'balanced' | 'fast';

export interface RuntimeConfig {
  llmProvider: LlmProviderName;
  voiceProvider: VoiceProviderName;
  visionProvider: VisionProviderName;
  authProvider: AuthProviderName;
  databaseProvider: DatabaseProviderName;
  billingMode: 'checkout' | 'waitlist';
  judgeMode: boolean;
}
```

| Provider | Deep | Balanced | Fast | Status |
|---|---|---|---|---|
| `fake` | deterministic fixture | deterministic fixture | deterministic fixture | Required for F3/CI; zero keys |
| Google | `gemini-2.5-pro` | `gemini-2.5-flash` | `gemini-2.5-flash-lite` | Dev default; quotas are dynamic per project and must not be hardcoded |
| OpenAI | `gpt-5.6-sol` (`gpt-5.6` alias) | `gpt-5.6-terra` | `gpt-5.6-luna` | Demo-capable runtime adapter |
| Anthropic | disabled pending deployment-account model verification | disabled | disabled | Adapter stays wired; no guessed model ids |

- Verification date: 2026-07-17. Gemini sources: [model catalog](https://ai.google.dev/gemini-api/docs/models) and [rate-limit policy](https://ai.google.dev/gemini-api/docs/rate-limits). GPT-5.6 sources: [OpenAI model catalog](https://developers.openai.com/api/docs/models) and [Sol model page](https://developers.openai.com/api/docs/models/gpt-5.6-sol).
- D-036 pins the coherent provider set: `ai@7.0.28`, `@ai-sdk/google@4.0.16`, `@ai-sdk/openai@4.0.15`, and `@ai-sdk/anthropic@4.0.15`. `package.json` and `pnpm-lock.yaml` must use these exact versions; no architecture code assumes a floating latest tag.
- AI SDK structured output is mandatory for parse. `generateObject({ model, schema: zodSchema })` remains exported and supported by the pinned Google, OpenAI, and Anthropic adapters, though it is deprecated in favor of `generateText` with `Output.object`. The capture implementation uses `generateObject` to match the locked pipeline.
- Provider schema constraints are part of parser design: Gemini structured schemas use an OpenAPI subset and must avoid unions; OpenAI structured schemas must avoid optional/nullish fields (use explicit nullable values); Anthropic chooses `outputFormat`, `jsonTool`, or `auto` through the adapter. The core proposal schema is flattened/discriminated before provider conversion.

### 2.1 Provider ports

```ts
import type { z } from 'zod';

export interface ObjectRequest<TSchema extends z.ZodType> {
  tier: Tier;
  schema: TSchema;
  system: string;
  prompt: string;
  images?: readonly ImageInput[];
  telemetry: { operation: 'capture-parse' | 'coach-brief' | 'coach-ask' | 'vision' };
}

export interface ObjectResult<T> {
  object: T;
  modelId: string;
  provider: LlmProviderName;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

export interface TextRequest {
  tier: Tier;
  system: string;
  prompt: string;
  telemetry: { operation: 'capture-line' | 'coach-ask' };
}

export interface LlmGateway {
  generateObject<TSchema extends z.ZodType>(request: ObjectRequest<TSchema>): Promise<ObjectResult<z.infer<TSchema>>>;
  generateText(request: TextRequest): Promise<{ text: string; modelId: string; provider: LlmProviderName; latencyMs: number }>;
}

export interface ImageInput {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  filename?: string;
}

export interface VoiceAudio {
  bytes: Uint8Array;
  mimeType: 'audio/webm' | 'audio/wav' | 'audio/mpeg';
  durationMs: number;
}

export interface Transcription {
  text: string;
  confidenceBps: number | null;
  languageCode: string | null;
}

export interface VoiceProvider {
  transcribe(audio: VoiceAudio, options?: { languageHint?: string }): Promise<Transcription>;
  speak?(text: string, options: { languageCode: string; voice?: string }): Promise<{ bytes: Uint8Array; mimeType: string }>;
}

export interface VisionProvider {
  analyze<TSchema extends z.ZodType>(input: {
    images: readonly ImageInput[];
    schema: TSchema;
    prompt: string;
    tier: 'deep' | 'balanced';
  }): Promise<ObjectResult<z.infer<TSchema>>>;
}
```

- `FakeLlmGateway` returns a versioned canonical `CaptureDraft`, canned coach line, and deterministic brief fixtures. `FakeVoiceProvider` returns the canonical transcript; `FakeVisionProvider` returns a deterministic meal/receipt fixture. No fake adapter reads an API key.
- `SarvamVoiceProvider` uses Saaras `saaras:v3` at `POST /speech-to-text` and optional Bulbul `bulbul:v3` at `POST /text-to-speech`; it passes the subscription key only in the provider adapter. Sarvam REST transcription is capped at 30 seconds, so longer audio is rejected to the UI before upload. [STT reference](https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe) · [TTS reference](https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert).

## 3. Authentication, database, and repositories

```ts
export interface AuthenticatedUser {
  userId: string;
  email: string | null;
  mode: 'local' | 'supabase';
}

export interface AuthProvider {
  requireUser(): Promise<AuthenticatedUser>;
  signUp(input: { email: string; password: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(input: { email: string; redirectTo: string }): Promise<void>;
  updatePassword(input: { password: string }): Promise<void>;
}

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

export interface ScopedEntityRepository<TRecord, TCreate, TUpdate, TQuery> {
  create(input: TCreate): Promise<TRecord>;
  byId(id: string): Promise<TRecord | null>;
  list(query: TQuery): Promise<readonly TRecord[]>;
  update(id: string, patch: TUpdate): Promise<TRecord>;
  softDelete(id: string): Promise<void>;
}
```

`ProfileRepository`, `MoneyRepositories`, `HealthRepositories`, `HabitRepositories`, `SkillRepositories`, `PlanRepositories`, `CoachRepositories`, `EvidenceRepository`, `CommitRepository`, and `BillingRepository` expose only concrete table-specific forms of `ScopedEntityRepository`.

- `LocalPasswordAuthProvider` validates the configured local password and always returns `userId: 'local-dev'`. It is the only auth provider used by fake-stack dev/CI.
- `SupabaseAuthProvider` handles email/password signup, sign-in, reset, and session verification. Supabase is never a dev/CI prerequisite.
- The route composition root obtains `AuthenticatedUser`, then calls `RepositoryFactory.forUser`. No repository method accepts `userId`, arbitrary SQL, or a caller-provided tenant filter.
- SQLite uses Drizzle with `better-sqlite3` (or libSQL if selected). Supabase uses Drizzle `postgres-js`; transaction-pool connections set `prepare: false`. SQLite and Postgres use equivalent dialect-specific Drizzle declarations over the shared contract; repository/business implementations are shared.
- Browser clients never query database tables directly. Supabase RLS and Storage policies mirror `userId` ownership as defense in depth; server routes remain the normal path.

## 4. Drizzle schema contract

### 4.1 Conventions and dialects

- Entity ids are application-generated UUID text. Every persistent user row has non-null `userId`; `profiles.userId` is its primary key.
- Mutable entity tables share `id`, `userId`, `createdAt`, `updatedAt`, and nullable `deletedAt`. Immutable/audit tables share `id`, `userId`, and `createdAt` only.
- Money is non-negative `amountPaise` plus explicit `direction`; quantities are integer `millilitres`, `minutes`, `grams`, and `weightGrams`. Confidence is `confidenceBps` in `0..10000`; no monetary float exists.
- `localDate` is ISO `YYYY-MM-DD`, `occurredAt` is UTC timestamp, and `timezone` is an IANA zone captured at entry time. Nullable means unknown; zero is a real value.
- JSON is limited to named Zod-validated support shapes (`DomainStatsSnapshot`, `PlanRule`, `CoachEvidence`, `CommitRowSnapshot`) and is never a generic accepted-entry payload.
- `schema/contract.ts` exports the enum unions/Zod shapes and column/index contract below. `schema/sqlite.ts` uses `sqliteTable`; `schema/postgres.ts` uses `pgTable`; each declares the same names, columns, unique constraints, and indexes. Migrations are generated/tested per dialect.

### 4.2 Profile and onboarding tables

| Table | Business columns | Constraints and indexes |
|---|---|---|
| `profiles` | `userId` PK, `displayName`, `birthDate`, `heightCm`, `weightGrams`, `unitSystem`, `theme`, `themeMode`, `wakeTimeMinutes`, `sleepTimeMinutes`, `timeBudgetMinutes`, `foodPattern`, `screenTimeMinutes`, `focusPreference`, `careerGoal`, `moneyGoal`, `plan`, `onboardingStatus`, `onboardingStep`, `seedVersion`, timestamps | `plan ∈ free/pro`; unique PK `userId`; index `(onboardingStatus, updatedAt)` |
| `profile_gaps` | base columns, `gapKey`, `prompt`, `optionsJson`, `status`, `answeredAt` | unique `(userId, gapKey)`; index `(userId, status)` |
| `seed_runs` | immutable base, `seedKey`, `seedVersion`, `completedAt` | unique `(userId, seedKey)`; drives idempotent D-033 cloning |

### 4.3 Money tables

| Table | Business columns | Constraints and indexes |
|---|---|---|
| `money_categories` | base columns, `name`, `kind` (`expense/income`), `colorKey`, `isSystem` | unique `(userId, name, kind)` |
| `transactions` | base columns, `occurredAt`, `localDate`, `timezone`, `direction`, `amountPaise`, `categoryId`, `merchant`, `note`, `source`, `confidenceBps`, `estimated`, `evidenceId`, `recurringRuleId` | indexes `(userId, localDate)`, `(userId, categoryId, localDate)`, `(userId, recurringRuleId)` |
| `recurring_rules` | base columns, `direction`, `amountPaise`, `categoryId`, `merchant`, `cadence`, `nextPostDate`, `isPaused` | index `(userId, nextPostDate)` |
| `budgets` | base columns, `categoryId`, `periodStart`, `periodEnd`, `limitPaise` | unique `(userId, categoryId, periodStart, periodEnd)` |

### 4.4 Health tables

| Table | Business columns | Constraints and indexes |
|---|---|---|
| `meals` | base columns, `occurredAt`, `localDate`, `timezone`, `kcal`, `proteinGrams`, `carbsGrams`, `fatGrams`, `source`, `confidenceBps`, `estimated`, `evidenceId`, `note` | index `(userId, localDate)` |
| `meal_items` | base columns, `mealId`, `name`, `quantityGrams`, `kcal`, `proteinGrams`, `carbsGrams`, `fatGrams`, `estimated`, `confidenceBps` | index `(userId, mealId)` |
| `water_logs` | base columns, `occurredAt`, `localDate`, `timezone`, `millilitres`, `source`, `confidenceBps`, `estimated` | index `(userId, localDate)` |
| `workouts` | base columns, `occurredAt`, `localDate`, `timezone`, `durationMinutes`, `burnKcal`, `source`, `confidenceBps`, `estimated`, `note` | index `(userId, localDate)` |
| `workout_exercises` | base columns, `workoutId`, `name`, `sets`, `reps`, `loadGrams`, `sortOrder` | index `(userId, workoutId, sortOrder)` |
| `weigh_ins` | base columns, `occurredAt`, `localDate`, `timezone`, `weightGrams`, `source`, `confidenceBps`, `estimated` | index `(userId, localDate)` |

### 4.5 Habits and skills tables

| Table | Business columns | Constraints and indexes |
|---|---|---|
| `habits` | base columns, `name`, `cadence`, `difficulty`, `targetValue`, `targetUnit`, `isArchived` | unique `(userId, name)` |
| `habit_logs` | base columns, `habitId`, `occurredAt`, `localDate`, `timezone`, `status`, `source`, `note` | unique `(userId, habitId, localDate)`; index `(userId, localDate)` |
| `habit_satisfaction_rules` | base columns, `habitId`, `sourceDomain`, `sourceKind`, `aggregateField`, `minimumValue`, `unit` | unique `(userId, habitId, sourceDomain, sourceKind, aggregateField)` |
| `skills` | base columns, `name`, `targetMinutes`, `isArchived` | unique `(userId, name)` |
| `skill_milestones` | base columns, `skillId`, `label`, `sortOrder`, `completedAt` | unique `(userId, skillId, sortOrder)` |
| `skill_sessions` | base columns, `skillId`, `occurredAt`, `localDate`, `timezone`, `minutes`, `source`, `note`, `confidenceBps`, `estimated` | index `(userId, skillId, localDate)` |

### 4.6 Plan, progress, coach, and evidence tables

| Table | Business columns | Constraints and indexes |
|---|---|---|
| `plan_arcs` | base columns, `domain`, `mode`, `title`, `startDate`, `endDate`, `dayNumber`, `status` | index `(userId, domain, status)` |
| `plan_items` | base columns, `arcId`, `domain`, `kind`, `title`, `dueAt`, `localDate`, `targetValue`, `targetUnit`, `status`, `completionSource`, `ruleJson`, `linkedHabitId`, `linkedSkillId` | index `(userId, localDate, status)`, `(userId, arcId, status)` |
| `domain_progress` | base columns, `domain` (`overall/health/money/habits/skills`), `xp`, `level`, `streak`, `bestStreak`, `cumulativeMinutes`, `lastActiveDate` | unique `(userId, domain)` |
| `day_one_snapshots` | immutable base, `domain`, `snapshotDate`, `statsJson` | unique `(userId, domain)` |
| `coach_notes` | immutable base, `scope` (`capture/daily/weekly`), `localDate`, `text`, `modelProvider`, `modelId`, `evidenceJson`, `stalenessKey` | unique `(userId, scope, stalenessKey)`; index `(userId, localDate, scope)` |
| `adaptations` | base columns, `planItemId`, `beforeJson`, `afterJson`, `reason`, `status` (`proposed/kept/reverted`), `keptAt`, `revertedAt`, `appliedCommitId` | index `(userId, status, createdAt)` |
| `evidence` | base columns, `domain`, `entryKind`, `entryId`, `storageProvider`, `storagePath`, `mimeType`, `sha256`, `caption`, `occurredAt`, `localDate` | unique `(userId, sha256)`; index `(userId, entryKind, entryId)` |

### 4.7 Commit/undo and billing tables

| Table | Business columns | Constraints and indexes |
|---|---|---|
| `commits` | immutable base, `draftId`, `idempotencyKey`, `kind` (`capture/tap/tool/edit/delete`), `status` (`committed/undone/superseded`), `undoExpiresAt`, `undoneAt`, `summary` | unique `(userId, idempotencyKey)`; index `(userId, status, createdAt)` |
| `commit_rows` | immutable base, `commitId`, `entryKind`, `entryId`, `operation` (`create/update/delete`), `beforeJson`, `afterJson` | unique `(userId, commitId, entryKind, entryId)` |
| `commit_progress_effects` | immutable base, `commitId`, `domain`, `xpDelta`, `levelBefore`, `levelAfter`, `streakBefore`, `streakAfter`, `minutesDelta` | index `(userId, commitId)` |
| `commit_plan_effects` | immutable base, `commitId`, `planItemId`, `statusBefore`, `statusAfter`, `completionSourceBefore`, `completionSourceAfter` | unique `(userId, commitId, planItemId)` |
| `checkout_sessions` | base columns, `provider` (`razorpay`), `providerReceiptId`, `amountPaise`, `currency` (`INR`), `status`, `checkoutUrl`, `expiresAt` | unique `(userId, providerReceiptId)`; index `(userId, status, createdAt)` |
| `billing_events` | immutable base, `provider` (`razorpay`), `providerEventId`, `eventType`, `checkoutSessionId`, `paymentId`, `outcome`, `payloadHash`, `processedAt` | unique `(provider, providerEventId)`; index `(userId, createdAt)` |
| `waitlist_requests` | immutable base, `source` (`pricing`), `requestedAt` | unique `(userId, source)`; created only for an authenticated user in `billingMode=waitlist` |

## 5. Capture contract, routing, commit, and undo

```ts
export type Domain = 'health' | 'money' | 'habits' | 'skills';
export type ProposalIntent = 'create' | 'correction' | 'backdate';
export type ProposalStatus = 'auto' | 'pending' | 'accepted' | 'discarded';
export type ProposalKind = 'transaction' | 'meal' | 'water' | 'workout' | 'weighIn' | 'habitLog' | 'skillSession';

export interface CaptureDraft {
  version: 1;
  draftId: string;
  rawText: string;
  capturedAt: string;
  timezone: string;
  source: 'voice' | 'text' | 'photo' | 'mixed';
  transcriptConfidenceBps: number | null;
  evidenceRefs: readonly DraftEvidenceRef[];
  proposals: readonly Proposal[];
  questions: readonly ClarificationQuestion[];
}

export type Proposal =
  | TransactionProposal | MealProposal | WaterProposal | WorkoutProposal | WeighInProposal
  | HabitLogProposal | SkillSessionProposal;

export interface ProposalBase {
  proposalId: string;
  domain: Domain;
  kind: ProposalKind;
  intent: ProposalIntent;
  occurredAt: string;
  localDate: string;
  timezone: string;
  estimated: boolean;
  confidenceBps: number;
  why: { basis: string; assumptions: readonly string[] };
  evidenceRefs: readonly DraftEvidenceRef[];
  matchedEntryId?: string;
}

export interface TransactionProposal extends ProposalBase {
  kind: 'transaction';
  payload: { direction: 'expense' | 'income'; amountPaise: number; categoryName: string; merchant: string | null; note: string | null };
}
export interface MealProposal extends ProposalBase {
  kind: 'meal';
  payload: { kcal: number; proteinGrams: number | null; carbsGrams: number | null; fatGrams: number | null; items: readonly MealItemInput[]; note: string | null };
}
export interface WaterProposal extends ProposalBase { kind: 'water'; payload: { millilitres: number }; }
export interface WorkoutProposal extends ProposalBase { kind: 'workout'; payload: { durationMinutes: number; burnKcal: number | null; exercises: readonly WorkoutExerciseInput[]; note: string | null }; }
export interface WeighInProposal extends ProposalBase { kind: 'weighIn'; payload: { weightGrams: number }; }
export interface HabitLogProposal extends ProposalBase { kind: 'habitLog'; payload: { habitName: string; status: 'done' | 'skipped'; note: string | null }; }
export interface SkillSessionProposal extends ProposalBase { kind: 'skillSession'; payload: { skillName: string; minutes: number; note: string | null }; }
```

### 5.1 Routing rules

1. `parseDump` calls the deep-tier `LlmGateway.generateObject` with the `CaptureDraft` Zod schema. Parse failure returns a retryable draft; it never creates a row.
2. `AUTO_WRITE_CONFIDENCE_BPS = 9000` is owned only by `core/capture/route.ts`.
3. A proposal routes to `auto` only if `intent === 'create'`, `estimated === false`, `confidenceBps >= 9000`, all payload integers validate, and it has no unanswered clarification dependency.
4. Every estimate, low-confidence explicit proposal, correction, backdate, photo-derived value, or question-dependent proposal routes to `pending`. A correction must show an entry selector and cannot update silently.
5. User edits turn the resolved value into `estimated: false`, `confidenceBps: 10000`, and `why.basis: 'user edit'`; accepting it is the user confirmation.
6. Accept-all is available only when every remaining card is `pending`, `confidenceBps >= 8000`, and has no clarification dependency. It is still an explicit user action.
7. Unknown unit, amount, date, category, habit, skill, or match is a pending question/card—not an invented row.

### 5.2 Typed commit service

```ts
export interface CommitService {
  commit(input: {
    draftId?: string;
    idempotencyKey: string;
    kind: 'capture' | 'tap' | 'tool' | 'edit' | 'delete';
    proposals: readonly ResolvedProposal[];
  }): Promise<CommitResult>;
  undoLatest(input: { commitId: string; now: string }): Promise<UndoResult>;
}
```

- `dispatchProposal` is an exhaustive switch on `Proposal.kind`; each branch calls the matching typed repository. No `tableName`/generic payload persistence path exists.
- Auto-filed proposals from one draft form one commit batch. One accepted card forms one batch; Accept-all forms one batch. Every new committed batch supersedes the previous active undo batch for that user.
- Within one database transaction, commit writes `commits`, typed entity rows, `commit_rows`, deterministic XP effects, plan/habit satisfied-by effects, and any evidence rows. It then writes one capture `CoachNote` through the fast tier after the transaction; failure of the note never rolls back a safe commit.
- Undo is allowed only for the latest `committed` batch for that user before `undoExpiresAt`. The compensating transaction restores update/delete snapshots, soft-deletes creates, reverses recorded progress/plan effects, marks the commit `undone`, and invalidates stale coach displays. There is no undo-history UI.
- `idempotencyKey` is generated on the client for one deliberate commit and persisted before retry. Replayed commit requests return the original result rather than duplicating typed rows or XP.

## 6. Coach engine and domain registry

```ts
export interface DomainSpec {
  domain: Domain;
  proposalKinds: readonly ProposalKind[];
  parseHints: string;
  coachInstructions: string;
  contextLoader: (repos: UserScopedRepositories, range: DateRange) => Promise<DomainCoachContext>;
  allowedTools: readonly CoachToolName[];
  evaluatePlanEffects: (input: DomainEvent, repos: UserScopedRepositories) => Promise<readonly PlanEffect[]>;
}

export interface CoachEngine {
  captureLine(input: { commit: CommitResult; domains: readonly Domain[] }): Promise<string>;
  dailyBrief(input: { localDate: string; timezone: string }): Promise<CoachNote>;
  weeklyBrief(input: { weekStart: string; timezone: string }): Promise<CoachNote>;
  ask(input: { text: string; timezone: string }): Promise<{ text: string; action?: CoachAction }>;
  proposeAdaptation(input: AdaptationInput): Promise<Adaptation>;
  resolveAdaptation(input: { adaptationId: string; action: 'keep' | 'revert' }): Promise<Adaptation>;
}
```

- `REGISTRY` has exactly four entries: Health, Money, Habits, and Skills. It supplies parse context, coach instructions, and allowed deterministic tools; it does not create four orchestrators.
- Fast tier writes the capture line. Deep tier writes daily/weekly briefs, potential projections, and adaptation proposals. Ask defaults to fast and escalates to deep only when it requires plan/money math.
- Coach output cannot directly mutate a plan. It creates an `adaptations` row in `proposed`; `Keep` applies the patch through `CommitService`, `Revert` leaves the plan unchanged. Re-entry may create the same visible proposal but never performs an invisible plan write.
- Brief uniqueness is `(userId, scope, stalenessKey)`. On-open generation reuses a fresh note and regenerates only when the configured staleness key changes.

## 7. Phase-1 auth, billing, legal, seed, and PWA contracts

### 7.1 Auth and ownership

- Production routes are `/signup`, `/login`, `/reset-password`, and the provider reset callback from `docs/screens/SCREEN-AUTH.md`.
- Signup creates a Supabase account, then creates/updates `profiles` only through the scoped repository. New users enter onboarding; returning incomplete users resume their saved step.
- Local fake-stack auth returns `local-dev` and follows the identical profile/onboarding flow over SQLite.

### 7.2 Razorpay rail

```ts
export interface BillingProvider {
  createAnnualCheckout(input: { userId: string; receiptId: string; amountPaise: 49900; currency: 'INR' }): Promise<{ checkoutUrl: string; providerReceiptId: string }>;
  verifyWebhook(input: { rawBody: Uint8Array; signature: string }): Promise<VerifiedBillingEvent>;
}
```

1. `POST /api/billing/checkout` requires an authenticated user, creates `checkout_sessions` with a server-generated receipt id, and calls Razorpay only for `49900` paise/INR.
2. `POST /api/billing/webhook` consumes raw bytes, verifies the Razorpay signature before parsing, derives the session/user from the server-created receipt, and inserts `billing_events` by unique provider event id.
3. In one transaction, a successful eligible event marks the checkout session paid, updates `profiles.plan` from `free` to `pro`, and records the successful billing event. Replays/duplicates return success without a second transition.
4. Browser success/cancel callbacks are display states only; no client route changes `plan`.
5. With `BILLING_MODE=waitlist`, checkout is never created; an authenticated request writes one `waitlist_requests` row and all v1 features remain free.

### 7.3 Judge seed, legal, and PWA

- After onboarding, `seedDemo(userId, 'demo-12-day-v1')` checks `seed_runs` then clones the fixed typed fixture rows in one transaction. A duplicate request returns the existing seed result. It never replaces real rows.
- Static `/privacy` and `/terms` are linked from auth/pricing. They accurately name AI processing, Supabase storage, export/delete behavior, and that health/money outputs are informational.
- `manifest.webmanifest` is install-only: Sarthi name, root start/scope, standalone display, Ember default colors, 192/512 maskable icons. There is no background sync, offline outbox, or push notification implementation in v1.

## 8. Eval harness and acceptance data

### 8.1 Deterministic fixtures

| Fixture | Expected safety/result |
|---|---|
| `canonical-cross-domain` | `Transaction(34000 paise)`, water, meal estimate card, skill session, habit log; only explicit high-confidence creates auto-write |
| `explicit-low-confidence` | no silent write; card or transcript correction state |
| `estimated-meal-photo` | no meal row until card acceptance |
| `ambiguous-skill` | question card; no invented skill session |
| `receipt-batch` | pending cards; Accept-all only through explicit action |
| `correction-existing-entry` | selected target updates in place; no duplicate |
| `backdate-habit` | pending confirmation, correct historical date, streak recalculation |
| `provider-failure` | retryable draft only; no persistent outbox or rows |
| `timer-session` | explicit completed/confirmed time writes one session and undo reverses mastery |
| `undo-batch` | typed rows, XP, plan effects, and satisfied-by effects restore atomically |
| `tenant-isolation` | user A cannot read, mutate, export, seed, or undo user B data |
| `billing-webhook-replay` | one Pro transition for repeated provider event |

### 8.2 Metrics and report shape

```ts
export interface EvalReport {
  runId: string;
  generatedAt: string;
  stack: { llmProvider: LlmProviderName; modelMatrix: Partial<Record<Tier, string>>; voiceProvider: VoiceProviderName };
  fixtures: Array<{ id: string; pass: boolean; expectedRows: number; actualRows: number; wrongSilentWrites: number; latencyMs: number; estimatedMae?: number }>;
  metrics: {
    parseAccuracy: number;
    routingAccuracy: number;
    wrongSilentWrites: number;
    estimateMae: number | null;
    stateMatchRate: number;
    adaptationSanityRate: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    costPerTurnUsd: number | null;
  };
}
```

- `wrongSilentWrites` is a hard-zero release condition: any estimated proposal committed without explicit acceptance, any low-confidence/ambiguous proposal auto-filed, or any unexpected typed row fails the run.
- Parse/routing accuracy score typed expected rows and proposal route/status, never prose similarity. Estimate MAE evaluates only accepted estimated values against fixture labels.
- The A/B report compares fake baseline, Gemini matrix, and OpenAI matrix when keys are present; fake is mandatory and network-free. Live-provider cost/latency fields are nullable when provider metadata is unavailable.

## 9. Build gates implied by this blueprint

1. Before schema code: implement the dialect schema contract, migrations, scoped repository factory, and `check:core-boundary` command exactly here.
2. Before parser code: implement and test the full Zod `CaptureDraft` union against every fixture above.
3. Before F3: fake LLM/voice/vision plus SQLite/local-password must pass `canonical-cross-domain`, `estimated-meal-photo`, `ambiguous-skill`, and `undo-batch` keylessly.
4. Before Phase 1: auth contract, tenant isolation test, seed idempotency test, and legal/PWA routes exist.
5. Before billing release: Razorpay test checkout, signature verification, webhook replay test, and waitlist fallback are proven; Pro remains non-gating.

## 10. Stage-3 sign-off checklist

- Model IDs and provider limitations are verified; no quota or Anthropic runtime model is guessed.
- Every persistent user table has `userId`; all operations route through the bound repository scope.
- Every accepted proposal dispatches to a per-domain typed table; support tables never become a generic entry store.
- Auto-write, correction, question, batch, undo, idempotency, and offline behavior are fully deterministic.
- The fake stack remains a complete local/CI path with no Supabase or API-key dependency.
- Phase-1 auth, seed, billing, legal, and PWA behavior are specified without paywalling F3/F11.
