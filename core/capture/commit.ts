/**
 * core/capture/commit.ts — the typed commit + undo service (SAR-004, D-D/D-F/D-H).
 *
 * `createCommitService({repos, llm, now?})` is framework-clean: the concrete
 * repository factory and gateway are INJECTED (core never imports them). Every
 * write goes through an EXHAUSTIVE per-kind switch into a typed repository — there
 * is no generic `tableName`/payload path. One `repos.transaction` writes the
 * envelope + typed rows + `commit_rows` snapshots + XP/progress effects; the
 * capture coach note is written AFTER the transaction and never rolls it back.
 * Commit/undo are single-flight per scope (D-F). Undo compensates the latest
 * committed batch within 5 minutes by restoring every row from its snapshot (D-H).
 */
import { randomUUID } from "node:crypto";

import type { UserScopedRepositories } from "@/core/contracts";
import type { LlmGateway } from "@/core/contracts";
import type { AdaptationRecord } from "@/data/schema/contract";
import { applyProgress, computeStreak, GRACE_DAYS, nextStreak, type ProgressEffect, type ProgressState } from "@/core/game";
import { xpForProposal } from "@/core/game";

import { resolvedProposalSchema } from "./contract";
import type { ProposalDomain, ResolvedProposal } from "./contract";

const UNDO_WINDOW_MS = 5 * 60 * 1000;

// HTTP requests construct fresh commit services/scopes, so the instance lock below
// cannot serialize a double-click that arrives through two routes at once. The
// idempotency key is client-generated per deliberate action and unique in the scoped
// commit ledger; this short-lived module lock turns the loser into a true replay
// instead of leaking a uniqueness error. Different keys continue independently.
const idempotencyTails = new Map<string, Promise<void>>();

function withIdempotencyLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = idempotencyTails.get(key) ?? Promise.resolve();
  const run = previous.then(work, work);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  idempotencyTails.set(key, settled);
  void settled.finally(() => {
    if (idempotencyTails.get(key) === settled) idempotencyTails.delete(key);
  });
  return run;
}

export type CommitKind = "capture" | "tap" | "tool" | "edit" | "delete";

export interface ProposalCommitInput {
  draftId?: string;
  idempotencyKey: string;
  kind: Exclude<CommitKind, "tool">;
  proposals: readonly ResolvedProposal[];
}

/** A deliberate Focus completion. The route resolves the scoped skill before this reaches the service. */
export interface FocusToolCommitInput {
  idempotencyKey: string;
  kind: "tool";
  tool: "focus";
  skillId: string;
  minutes: number;
  occurredAt: string;
  localDate: string;
  timezone: string;
}

/**
 * Meditation's first-use setup is part of the command, never a generic extra row.
 * The service creates the `Meditate` habit in the same transaction when `create` is
 * selected, so one undo removes the log before the new habit.
 */
export interface MeditationToolCommitInput {
  idempotencyKey: string;
  kind: "tool";
  tool: "meditation";
  habit: { mode: "existing"; habitId: string } | { mode: "create" };
  minutes: number;
  occurredAt: string;
  localDate: string;
  timezone: string;
}

/** Exhaustive commit command surface; tools cannot smuggle a generic row/payload. */
export type CommitInput = ProposalCommitInput | FocusToolCommitInput | MeditationToolCommitInput;

export interface WrittenEntry {
  entryKind: string;
  entryId: string;
}

export interface CommitResult {
  commitId: string;
  status: "committed" | "replayed";
  entries: WrittenEntry[];
  progressEffects: ProgressEffect[];
  coachNoteId: string | null;
  undoExpiresAt: string;
}

export interface UndoResult {
  commitId: string;
  restoredEntryIds: string[];
  removedEntryIds: string[];
  staleCoachNoteStalenessKey: string;
}

export class UndoNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UndoNotAvailableError";
  }
}

export interface CommitService {
  commit(input: CommitInput): Promise<CommitResult>;
  /**
   * The only mutating adaptation resolution. The proposal's typed plan snapshot
   * is validated server-side, then committed under the same latest-batch undo
   * envelope as capture. Callers never supply snapshots or a plan-item patch.
   */
  applyAdaptationPlanPatch(input: {
    adaptationId: string;
    idempotencyKey: string;
  }): Promise<AdaptationCommitResult>;
  undoLatest(input: { commitId: string; now: string }): Promise<UndoResult>;
}

export interface AdaptationCommitResult {
  adaptation: AdaptationRecord;
  commit: CommitResult;
}

export interface CreateCommitServiceOptions {
  repos: UserScopedRepositories;
  llm: LlmGateway;
  now?: () => string;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const IDENTITY_COLUMNS = new Set(["id", "userId", "createdAt", "updatedAt", "deletedAt"]);

type Scalar = string | number | boolean | null;

/** The scalar columns of a persisted row, for a `CommitRowSnapshot`. */
function scalarColumns(record: Record<string, unknown>): Record<string, Scalar> {
  const columns: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      columns[key] = value;
    }
  }
  return columns;
}

/** Business fields of a snapshot, i.e. everything a scoped `update` may restore. */
function businessColumns(columns: Record<string, Scalar>): Record<string, Scalar> {
  const patch: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(columns)) {
    if (!IDENTITY_COLUMNS.has(key)) {
      patch[key] = value;
    }
  }
  return patch;
}

/** A proposal is stale if its plan snapshot no longer describes the scoped row. */
function matchesSnapshot(record: Record<string, unknown>, columns: Record<string, Scalar>): boolean {
  return Object.entries(columns).every(([key, value]) => record[key] === value);
}

/** entryKind → the scoped repository that owns it (for snapshots + undo). */
function repoForEntryKind(repos: UserScopedRepositories, entryKind: string) {
  switch (entryKind) {
    case "transaction":
      return repos.money.transactions;
    case "meal":
      return repos.health.meals;
    case "mealItem":
      return repos.health.mealItems;
    case "water":
      return repos.health.waterLogs;
    case "workout":
      return repos.health.workouts;
    case "workoutExercise":
      return repos.health.workoutExercises;
    case "weighIn":
      return repos.health.weighIns;
    case "habitLog":
      return repos.habits.logs;
    case "habit":
      return repos.habits.habits;
    case "skillSession":
      return repos.skills.sessions;
    case "domainProgress":
      return repos.plans.progress;
    case "planItem":
      return repos.plans.items;
    default:
      return null;
  }
}

function toInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** The committed source rows for a satisfaction rule's `sourceKind`, for aggregation. */
async function sourceRowsForKind(
  repos: UserScopedRepositories,
  sourceKind: string,
): Promise<Record<string, unknown>[]> {
  const asRows = (rows: readonly unknown[]) => rows as Record<string, unknown>[];
  switch (sourceKind) {
    case "skillSession":
      return asRows(await repos.skills.sessions.list({}));
    case "workout":
      return asRows(await repos.health.workouts.list({}));
    case "water":
      return asRows(await repos.health.waterLogs.list({}));
    case "meal":
      return asRows(await repos.health.meals.list({}));
    case "transaction":
      return asRows(await repos.money.transactions.list({}));
    case "weighIn":
      return asRows(await repos.health.weighIns.list({}));
    case "habitLog":
      return asRows(await repos.habits.logs.list({}));
    default:
      return [];
  }
}

/**
 * Every activity `localDate` for a domain, across its source tables (deduping happens
 * in `computeStreak`). Called inside the commit transaction AFTER dispatch, so the
 * just-written rows — including a backdated one — are included, which is what makes
 * the grace-aware backdate streak recompute (D-G/D-H) correct.
 */
async function domainActivityDates(repos: UserScopedRepositories, domain: ProposalDomain): Promise<string[]> {
  const dates: string[] = [];
  const push = (rows: readonly unknown[]) => {
    for (const row of rows as Record<string, unknown>[]) {
      if (typeof row.localDate === "string") {
        dates.push(row.localDate);
      }
    }
  };
  switch (domain) {
    case "health":
      push(await repos.health.meals.list({}));
      push(await repos.health.waterLogs.list({}));
      push(await repos.health.workouts.list({}));
      push(await repos.health.weighIns.list({}));
      break;
    case "money":
      push(await repos.money.transactions.list({}));
      break;
    case "habits":
      push(await repos.habits.logs.list({}));
      break;
    case "skills":
      push(await repos.skills.sessions.list({}));
      break;
    default: {
      const _never: never = domain;
      return _never;
    }
  }
  return dates;
}

interface DispatchedRow {
  entryKind: string;
  entryId: string;
  domain: ProposalDomain;
  minutes: number;
  record: Record<string, unknown>;
}

/**
 * Create the typed row(s) for one resolved CREATE proposal. Exhaustive over the 7
 * kinds; the compiler's `never` check guarantees no kind is ever dropped into a
 * generic path. Returns the primary row plus any child rows (meal items, exercises).
 */
async function dispatchCreate(
  repos: UserScopedRepositories,
  proposal: Extract<ResolvedProposal, { status: "auto" | "accepted" }>,
  source: "capture" | "timer" | "tool" = "capture",
): Promise<DispatchedRow[]> {
  const when = { occurredAt: proposal.occurredAt, localDate: proposal.localDate, timezone: proposal.timezone };
  const meta = { source, confidenceBps: proposal.confidenceBps, estimated: proposal.estimated };

  switch (proposal.kind) {
    case "transaction": {
      const record = await repos.money.transactions.create({
        ...when,
        direction: proposal.payload.direction === "expense" ? "debit" : "credit",
        amountPaise: proposal.payload.amountPaise,
        categoryId: proposal.payload.categoryId,
        merchant: proposal.payload.merchant,
        note: proposal.payload.note,
        ...meta,
        evidenceId: null,
        recurringRuleId: null,
      });
      return [{ entryKind: "transaction", entryId: record.id, domain: "money", minutes: 0, record }];
    }
    case "meal": {
      const record = await repos.health.meals.create({
        ...when,
        kcal: proposal.payload.kcal,
        proteinGrams: proposal.payload.proteinGrams,
        carbsGrams: proposal.payload.carbsGrams,
        fatGrams: proposal.payload.fatGrams,
        ...meta,
        evidenceId: null,
        note: proposal.payload.note,
      });
      const rows: DispatchedRow[] = [{ entryKind: "meal", entryId: record.id, domain: "health", minutes: 0, record }];
      for (const item of proposal.payload.items) {
        const child = await repos.health.mealItems.create({
          mealId: record.id,
          name: item.name,
          quantityGrams: null,
          kcal: null,
          proteinGrams: null,
          carbsGrams: null,
          fatGrams: null,
          estimated: proposal.estimated,
          confidenceBps: proposal.confidenceBps,
        });
        rows.push({ entryKind: "mealItem", entryId: child.id, domain: "health", minutes: 0, record: child });
      }
      return rows;
    }
    case "water": {
      const record = await repos.health.waterLogs.create({ ...when, millilitres: proposal.payload.millilitres, ...meta });
      return [{ entryKind: "water", entryId: record.id, domain: "health", minutes: 0, record }];
    }
    case "workout": {
      const record = await repos.health.workouts.create({
        ...when,
        durationMinutes: proposal.payload.durationMinutes,
        burnKcal: proposal.payload.burnKcal,
        ...meta,
        note: proposal.payload.note,
      });
      const rows: DispatchedRow[] = [
        { entryKind: "workout", entryId: record.id, domain: "health", minutes: proposal.payload.durationMinutes, record },
      ];
      let sortOrder = 0;
      for (const exercise of proposal.payload.exercises) {
        const child = await repos.health.workoutExercises.create({
          workoutId: record.id,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          loadGrams: exercise.loadGrams,
          sortOrder: sortOrder++,
        });
        rows.push({ entryKind: "workoutExercise", entryId: child.id, domain: "health", minutes: 0, record: child });
      }
      return rows;
    }
    case "weighIn": {
      const record = await repos.health.weighIns.create({ ...when, weightGrams: proposal.payload.weightGrams, ...meta });
      return [{ entryKind: "weighIn", entryId: record.id, domain: "health", minutes: 0, record }];
    }
    case "habitLog": {
      const record = await repos.habits.logs.create({
        ...when,
        habitId: proposal.payload.habitId,
        status: proposal.payload.status,
        source,
        note: proposal.payload.note,
      });
      return [{ entryKind: "habitLog", entryId: record.id, domain: "habits", minutes: 0, record }];
    }
    case "skillSession": {
      const record = await repos.skills.sessions.create({
        ...when,
        skillId: proposal.payload.skillId,
        minutes: proposal.payload.minutes,
        source,
        note: proposal.payload.note,
        confidenceBps: proposal.confidenceBps,
        estimated: proposal.estimated,
      });
      return [{ entryKind: "skillSession", entryId: record.id, domain: "skills", minutes: proposal.payload.minutes, record }];
    }
  }
}

interface CorrectionRow {
  entryKind: string;
  entryId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertToolCommand(input: FocusToolCommitInput | MeditationToolCommitInput): void {
  assertPositiveInteger(input.minutes, "tool minutes");
  if (!input.idempotencyKey || !input.occurredAt || !input.localDate || !input.timezone) {
    throw new Error("tool command is missing required timing or idempotency fields");
  }
  if (input.tool === "focus" && !input.skillId) {
    throw new Error("focus command requires a resolved skill");
  }
  if (input.tool === "meditation" && input.habit.mode === "existing" && !input.habit.habitId) {
    throw new Error("meditation command requires a resolved habit");
  }
}

function toolProposal(input: FocusToolCommitInput | MeditationToolCommitInput, habitId: string): ResolvedProposal {
  const common = {
    proposalId: randomUUID(),
    intent: "create" as const,
    occurredAt: input.occurredAt,
    localDate: input.localDate,
    timezone: input.timezone,
    estimated: false,
    confidenceBps: 10000,
    why: { basis: "explicit tool completion", assumptions: [] },
    evidenceRefs: [],
    status: "accepted" as const,
  };
  if (input.tool === "focus") {
    return {
      ...common,
      domain: "skills",
      kind: "skillSession",
      payload: { skillId: input.skillId, minutes: input.minutes, note: null },
    };
  }
  return {
    ...common,
    domain: "habits",
    kind: "habitLog",
    payload: { habitId, status: "done", note: `Meditation · ${input.minutes} min` },
  };
}

/**
 * Update the matched existing entry IN PLACE for a `correction` (F4a) — never a
 * duplicate row. Exhaustive over the 7 kinds; the accepted values persist as the
 * proposal's (post-user-edit) `estimated`/`confidenceBps`.
 */
async function dispatchCorrection(
  repos: UserScopedRepositories,
  proposal: Extract<ResolvedProposal, { status: "auto" | "accepted" }>,
): Promise<CorrectionRow> {
  const id = proposal.matchedEntryId;
  if (!id) {
    throw new Error(`correction proposal ${proposal.proposalId} has no matchedEntryId`);
  }
  const meta = { estimated: proposal.estimated, confidenceBps: proposal.confidenceBps };

  switch (proposal.kind) {
    case "transaction": {
      const before = await repos.money.transactions.byId(id);
      if (!before) throw new Error(`transaction ${id} not found for correction`);
      const after = await repos.money.transactions.update(id, {
        direction: proposal.payload.direction === "expense" ? "debit" : "credit",
        amountPaise: proposal.payload.amountPaise,
        categoryId: proposal.payload.categoryId,
        merchant: proposal.payload.merchant,
        note: proposal.payload.note,
        ...meta,
      });
      return { entryKind: "transaction", entryId: id, before, after };
    }
    case "meal": {
      const before = await repos.health.meals.byId(id);
      if (!before) throw new Error(`meal ${id} not found for correction`);
      const after = await repos.health.meals.update(id, {
        kcal: proposal.payload.kcal,
        proteinGrams: proposal.payload.proteinGrams,
        carbsGrams: proposal.payload.carbsGrams,
        fatGrams: proposal.payload.fatGrams,
        note: proposal.payload.note,
        ...meta,
      });
      return { entryKind: "meal", entryId: id, before, after };
    }
    case "water": {
      const before = await repos.health.waterLogs.byId(id);
      if (!before) throw new Error(`water log ${id} not found for correction`);
      const after = await repos.health.waterLogs.update(id, { millilitres: proposal.payload.millilitres, ...meta });
      return { entryKind: "water", entryId: id, before, after };
    }
    case "workout": {
      const before = await repos.health.workouts.byId(id);
      if (!before) throw new Error(`workout ${id} not found for correction`);
      const after = await repos.health.workouts.update(id, {
        durationMinutes: proposal.payload.durationMinutes,
        burnKcal: proposal.payload.burnKcal,
        note: proposal.payload.note,
        ...meta,
      });
      return { entryKind: "workout", entryId: id, before, after };
    }
    case "weighIn": {
      const before = await repos.health.weighIns.byId(id);
      if (!before) throw new Error(`weigh-in ${id} not found for correction`);
      const after = await repos.health.weighIns.update(id, { weightGrams: proposal.payload.weightGrams, ...meta });
      return { entryKind: "weighIn", entryId: id, before, after };
    }
    case "habitLog": {
      const before = await repos.habits.logs.byId(id);
      if (!before) throw new Error(`habit log ${id} not found for correction`);
      const after = await repos.habits.logs.update(id, {
        status: proposal.payload.status,
        note: proposal.payload.note,
      });
      return { entryKind: "habitLog", entryId: id, before, after };
    }
    case "skillSession": {
      const before = await repos.skills.sessions.byId(id);
      if (!before) throw new Error(`skill session ${id} not found for correction`);
      const after = await repos.skills.sessions.update(id, {
        minutes: proposal.payload.minutes,
        note: proposal.payload.note,
        ...meta,
      });
      return { entryKind: "skillSession", entryId: id, before, after };
    }
  }
}

/* ── the service ─────────────────────────────────────────────────────────── */

export function createCommitService(options: CreateCommitServiceOptions): CommitService {
  const { repos, llm } = options;
  const now = options.now ?? (() => new Date().toISOString());

  // Single-flight per scope (D-F): serialize commit/undo so `repos.transaction`
  // (and the `ScopeContext` executor swap) is never re-entered.
  let tail: Promise<unknown> = Promise.resolve();
  function withLock<T>(work: () => Promise<T>): Promise<T> {
    const run = tail.then(work, work);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function reconstruct(commitId: string): Promise<CommitResult> {
    const envelope = await repos.commits.commits.byId(commitId);
    const rows = (await repos.commits.rows.list({})).filter((r) => r.commitId === commitId);
    const effects = (await repos.commits.progressEffects.list({})).filter((e) => e.commitId === commitId);
    return {
      commitId,
      status: "replayed",
      entries: rows
        // The written entries the caller saw: typed creates + correction updates +
        // satisfied-by logs. Internal snapshots (domainProgress / planItem) are excluded,
        // so a replayed correction returns its updated entry, matching the original result.
        .filter((r) => r.entryKind !== "domainProgress" && r.entryKind !== "planItem")
        .map((r) => ({ entryKind: r.entryKind, entryId: r.entryId })),
      progressEffects: effects.map((e) => ({
        xpDelta: e.xpDelta,
        levelBefore: e.levelBefore,
        levelAfter: e.levelAfter,
        streakBefore: e.streakBefore,
        streakAfter: e.streakAfter,
        minutesDelta: e.minutesDelta,
      })),
      coachNoteId: null,
      undoExpiresAt: envelope?.undoExpiresAt ?? "",
    };
  }

  async function commit(input: CommitInput): Promise<CommitResult> {
    return withIdempotencyLock(input.idempotencyKey, () => withLock(async () => {
      // Resolved-strict gate (N-2): run the commit contract at RUNTIME, not just in
      // the type system. A null/float/unresolved payload is rejected here, before any
      // write, instead of surfacing as a mid-transaction repository throw. The route +
      // resolve layers already produce conforming proposals; this is defence in depth
      // for the SAR-006 API boundary where the type system will not exist.
      let proposals: ResolvedProposal[] = [];
      if (input.kind === "tool") {
        assertToolCommand(input);
      } else {
        proposals = input.proposals.map((p) => resolvedProposalSchema.parse(p));
      }

      // 1. Idempotency: a replayed key returns the original, never duplicates.
      const existing = (await repos.commits.commits.list({})).find(
        (c) => c.idempotencyKey === input.idempotencyKey,
      );
      if (existing) {
        return reconstruct(existing.id);
      }

      const nowIso = now();
      const commitId = randomUUID();
      const undoExpiresAt = new Date(Date.parse(nowIso) + UNDO_WINDOW_MS).toISOString();
      const entries: WrittenEntry[] = [];
      const progressEffects: ProgressEffect[] = [];

      await repos.transaction(async () => {
        // 2a. Supersede the previous active undo batch (there is at most one).
        const active = (await repos.commits.commits.list({})).filter((c) => c.status === "committed");
        for (const previous of active) {
          await repos.commits.markSuperseded(previous.id);
        }

        // 2b. The envelope.
        await repos.commits.commits.create({
          id: commitId,
          draftId: input.kind === "tool" ? null : input.draftId ?? null,
          idempotencyKey: input.idempotencyKey,
          kind: input.kind,
          status: "committed",
          undoExpiresAt,
          undoneAt: null,
          summary:
            input.kind === "tool"
              ? input.tool === "focus"
                ? `Logged ${input.minutes} focus minutes`
                : `Logged ${input.minutes} meditation minutes`
              : `${proposals.length} entr${proposals.length === 1 ? "y" : "ies"} via capture`,
        });

        // A tool command is resolved only after the transaction begins. This keeps the
        // first-use Meditation habit and its dated log in one atomic, undoable batch.
        if (input.kind === "tool") {
          if (input.tool === "focus") {
            const skill = await repos.skills.skills.byId(input.skillId);
            if (!skill || skill.isArchived) throw new Error("focus skill is unavailable in this user scope");
            proposals = [toolProposal(input, "")];
          } else {
            let habitId: string;
            if (input.habit.mode === "existing") {
              const existingHabit = await repos.habits.habits.byId(input.habit.habitId);
              if (!existingHabit || existingHabit.isArchived || existingHabit.name.toLocaleLowerCase() !== "meditate") {
                throw new Error("Meditate habit is unavailable in this user scope");
              }
              const existingLog = (await repos.habits.logs.list({})).some(
                (log) => log.habitId === existingHabit.id && log.localDate === input.localDate,
              );
              if (existingLog) throw new Error("Meditation is already logged for this day");
              habitId = existingHabit.id;
            } else {
              const createdHabit = await repos.habits.habits.create({
                name: "Meditate",
                cadence: "daily",
                difficulty: "easy",
                targetValue: null,
                targetUnit: "minutes",
                isArchived: false,
              });
              habitId = createdHabit.id;
              entries.push({ entryKind: "habit", entryId: createdHabit.id });
              await repos.commits.rows.create({
                commitId,
                entryKind: "habit",
                entryId: createdHabit.id,
                operation: "create",
                beforeJson: null,
                afterJson: {
                  entryKind: "habit",
                  entryId: createdHabit.id,
                  columns: scalarColumns(createdHabit as unknown as Record<string, unknown>),
                },
              });
            }
            proposals = [toolProposal(input, habitId)];
          }
        }

        // 2c. Exhaustive typed dispatch → typed rows + create snapshots.
        const perDomain = new Map<
          ProposalDomain,
          { xpDelta: number; minutesDelta: number; localDate: string; hasBackdate: boolean }
        >();
        for (const proposal of proposals) {
          if (proposal.intent === "correction") {
            // F4a: update the matched entry in place — no duplicate, no new XP.
            const corrected = await dispatchCorrection(repos, proposal);
            entries.push({ entryKind: corrected.entryKind, entryId: corrected.entryId });
            await repos.commits.rows.create({
              commitId,
              entryKind: corrected.entryKind,
              entryId: corrected.entryId,
              operation: "update",
              beforeJson: { entryKind: corrected.entryKind, entryId: corrected.entryId, columns: scalarColumns(corrected.before) },
              afterJson: { entryKind: corrected.entryKind, entryId: corrected.entryId, columns: scalarColumns(corrected.after) },
            });
            continue;
          }
          const source =
            input.kind !== "tool" ? "capture" : input.tool === "focus" ? "timer" : "tool";
          const rows = await dispatchCreate(repos, proposal, source);
          for (const row of rows) {
            entries.push({ entryKind: row.entryKind, entryId: row.entryId });
            await repos.commits.rows.create({
              commitId,
              entryKind: row.entryKind,
              entryId: row.entryId,
              operation: "create",
              beforeJson: null,
              afterJson: { entryKind: row.entryKind, entryId: row.entryId, columns: scalarColumns(row.record) },
            });
          }
          const primary = rows[0];
          const bucket = perDomain.get(primary.domain) ?? {
            xpDelta: 0,
            minutesDelta: 0,
            localDate: proposal.localDate,
            hasBackdate: false,
          };
          bucket.xpDelta += xpForProposal(proposal.kind, primary.minutes);
          bucket.minutesDelta += primary.minutes;
          bucket.localDate = proposal.localDate > bucket.localDate ? proposal.localDate : bucket.localDate;
          bucket.hasBackdate = bucket.hasBackdate || proposal.intent === "backdate";
          perDomain.set(primary.domain, bucket);
        }

        // 2d/e. XP + progress per touched domain (domain_progress snapshotted for exact undo).
        for (const [domain, delta] of perDomain) {
          const current = (await repos.plans.progress.list({})).find((p) => p.domain === domain) ?? null;
          const before: ProgressState = current
            ? {
                xp: current.xp,
                level: current.level,
                streak: current.streak,
                bestStreak: current.bestStreak,
                cumulativeMinutes: current.cumulativeMinutes,
                lastActiveDate: current.lastActiveDate,
              }
            : { xp: 0, level: 1, streak: 0, bestStreak: 0, cumulativeMinutes: 0, lastActiveDate: null };

          // `lastActiveDate` NEVER regresses: a backdate is a PAST day, not new "latest
          // activity", so the latest active day is max(prior, this batch's max date).
          const lastActiveAfter =
            before.lastActiveDate && before.lastActiveDate > delta.localDate
              ? before.lastActiveDate
              : delta.localDate;
          // A batch touching a backdate recomputes the streak grace-aware over the
          // domain's logs (D-G/D-H) — the incremental form would mis-count a past day.
          // A pure-forward batch keeps the cheap incremental form. SAR-004's streak is
          // "days with activity across all logs"; the done/skip-aware habit streak is SAR-009.
          const streakAfter = delta.hasBackdate
            ? computeStreak(await domainActivityDates(repos, domain), lastActiveAfter, GRACE_DAYS)
            : nextStreak(before.streak, before.lastActiveDate, delta.localDate, GRACE_DAYS);
          const { after, effect } = applyProgress(before, {
            xpDelta: delta.xpDelta,
            minutesDelta: delta.minutesDelta,
            streakAfter,
            lastActiveDate: lastActiveAfter,
          });

          const patch = {
            xp: after.xp,
            level: after.level,
            streak: after.streak,
            bestStreak: after.bestStreak,
            cumulativeMinutes: after.cumulativeMinutes,
            lastActiveDate: after.lastActiveDate,
          };
          // `domain_progress` is a persistent singleton per (userId, domain). Ensure
          // the row exists (a zero-state init is NOT part of the reversible batch),
          // then record the change as an UPDATE. Undo restores the exact prior values
          // (xp 0 for a fresh domain) WITHOUT soft-deleting the singleton — soft-delete
          // would leave the row occupying the unique (userId, domain) and collide with
          // the next commit for that domain.
          const row =
            current ??
            (await repos.plans.progress.create({
              domain,
              xp: 0,
              level: 1,
              streak: 0,
              bestStreak: 0,
              cumulativeMinutes: 0,
              lastActiveDate: null,
            }));
          const beforeColumns = scalarColumns(row as unknown as Record<string, unknown>);
          const updated = await repos.plans.progress.update(row.id, patch);
          await repos.commits.rows.create({
            commitId,
            entryKind: "domainProgress",
            entryId: row.id,
            operation: "update",
            beforeJson: { entryKind: "domainProgress", entryId: row.id, columns: beforeColumns },
            afterJson: { entryKind: "domainProgress", entryId: row.id, columns: scalarColumns(updated as unknown as Record<string, unknown>) },
          });

          await repos.commits.progressEffects.create({ commitId, domain, ...effect });
          progressEffects.push(effect);
        }
        // 2f. Plan effects: mark matching active plan items done. Reversal is via the
        // `commit_rows` snapshot (undo restores the prior status/source). Empty
        // pre-SAR-012 → zero effects, but the writer + reversal are complete now.
        const touchedDomains = new Set<string>([...perDomain.keys()]);
        const touchedDates = new Set(proposals.map((p) => p.localDate));
        const completionSource = input.kind === "tool" ? "tool" : "capture";
        const planItems = await repos.plans.items.list({});
        for (const item of planItems) {
          if (item.status === "done" || item.status === "skipped") {
            continue;
          }
          if (!touchedDomains.has(item.domain) || !touchedDates.has(item.localDate)) {
            continue;
          }
          const beforeColumns = scalarColumns(item as unknown as Record<string, unknown>);
          const updated = await repos.plans.items.update(item.id, { status: "done", completionSource });
          await repos.commits.rows.create({
            commitId,
            entryKind: "planItem",
            entryId: item.id,
            operation: "update",
            beforeJson: { entryKind: "planItem", entryId: item.id, columns: beforeColumns },
            afterJson: { entryKind: "planItem", entryId: item.id, columns: scalarColumns(updated as unknown as Record<string, unknown>) },
          });
          await repos.commits.planEffects.create({
            commitId,
            planItemId: item.id,
            statusBefore: item.status,
            statusAfter: "done",
            completionSourceBefore: item.completionSource,
            completionSourceAfter: completionSource,
          });
        }

        // 2g. Satisfied-by effects: auto-complete a habit when its satisfaction rule's
        // aggregate threshold is met for a touched day. The auto habit_log is a normal
        // typed row → undo reverses it via the create→softDelete path. Empty pre-SAR-009
        // → zero effects, but the writer + reversal are complete now (build once).
        const rules = await repos.habits.satisfactionRules.list({});
        for (const rule of rules) {
          for (const localDate of touchedDates) {
            const dayRows = (await sourceRowsForKind(repos, rule.sourceKind)).filter((row) => row.localDate === localDate);
            const total = dayRows.reduce((sum, row) => sum + toInt(row[rule.aggregateField]), 0);
            if (total < rule.minimumValue) {
              continue;
            }
            const alreadyLogged = (await repos.habits.logs.list({})).some(
              (log) => log.habitId === rule.habitId && log.localDate === localDate,
            );
            if (alreadyLogged) {
              continue;
            }
            const timezone = proposals.find((p) => p.localDate === localDate)?.timezone ?? "UTC";
            const log = await repos.habits.logs.create({
              habitId: rule.habitId,
              occurredAt: nowIso,
              localDate,
              timezone,
              status: "done",
              source: "satisfied-by",
              note: null,
            });
            entries.push({ entryKind: "habitLog", entryId: log.id });
            await repos.commits.rows.create({
              commitId,
              entryKind: "habitLog",
              entryId: log.id,
              operation: "create",
              beforeJson: null,
              afterJson: { entryKind: "habitLog", entryId: log.id, columns: scalarColumns(log as unknown as Record<string, unknown>) },
            });
          }
        }
      });

      // 3. Capture coach note AFTER the transaction. Its failure never rolls back a safe commit.
      let coachNoteId: string | null = null;
      try {
        const line = await llm.generateText({
          tier: "fast",
          system: "Write one short, warm reaction to the just-logged entries.",
          prompt: `Committed ${proposals.length} entries.`,
          telemetry: { operation: "capture-line" },
        });
        const localDate = proposals[0]?.localDate ?? nowIso.slice(0, 10);
        const note = await repos.coach.notes.create({
          scope: "capture",
          localDate,
          text: line.text,
          modelProvider: line.provider,
          modelId: line.modelId,
          evidenceJson: { generatedForLocalDate: localDate, items: [] },
          stalenessKey: `commit:${commitId}`,
        });
        coachNoteId = note.id;
      } catch {
        coachNoteId = null;
      }

      return { commitId, status: "committed", entries, progressEffects, coachNoteId, undoExpiresAt };
    }));
  }

  async function applyAdaptationPlanPatch(input: {
    adaptationId: string;
    idempotencyKey: string;
  }): Promise<AdaptationCommitResult> {
    return withLock(async () => {
      const existing = (await repos.commits.commits.list({})).find(
        (commit) => commit.idempotencyKey === input.idempotencyKey,
      );
      const adaptation = await repos.coach.adaptations.byId(input.adaptationId);
      if (existing) {
        if (!adaptation || adaptation.appliedCommitId !== existing.id) {
          throw new Error("adaptation idempotency key does not belong to this scoped proposal");
        }
        return { adaptation, commit: await reconstruct(existing.id) };
      }
      if (!adaptation || adaptation.status !== "proposed") {
        throw new Error("adaptation is not an open scoped proposal");
      }
      const before = adaptation.beforeJson;
      const after = adaptation.afterJson;
      if (
        before.entryKind !== "planItem" ||
        after.entryKind !== "planItem" ||
        before.entryId !== adaptation.planItemId ||
        after.entryId !== adaptation.planItemId
      ) {
        throw new Error("adaptation must contain one matching typed plan-item snapshot");
      }

      const current = await repos.plans.items.byId(adaptation.planItemId);
      if (!current || !matchesSnapshot(current as unknown as Record<string, unknown>, before.columns)) {
        throw new Error("adaptation plan snapshot is stale or unavailable");
      }

      const nowIso = now();
      const commitId = randomUUID();
      const undoExpiresAt = new Date(Date.parse(nowIso) + UNDO_WINDOW_MS).toISOString();
      let kept: AdaptationRecord | null = null;

      await repos.transaction(async () => {
        const active = (await repos.commits.commits.list({})).filter((commit) => commit.status === "committed");
        for (const previous of active) {
          await repos.commits.markSuperseded(previous.id);
        }
        await repos.commits.commits.create({
          id: commitId,
          draftId: null,
          idempotencyKey: input.idempotencyKey,
          kind: "tool",
          status: "committed",
          undoExpiresAt,
          undoneAt: null,
          summary: "Kept one proposed plan adjustment",
        });
        const updatedPlan = await repos.plans.items.update(
          adaptation.planItemId,
          businessColumns(after.columns),
        );
        await repos.commits.rows.create({
          commitId,
          entryKind: "planItem",
          entryId: adaptation.planItemId,
          operation: "update",
          beforeJson: before,
          afterJson: {
            entryKind: "planItem",
            entryId: adaptation.planItemId,
            columns: scalarColumns(updatedPlan as unknown as Record<string, unknown>),
          },
        });
        kept = await repos.coach.adaptations.update(adaptation.id, {
          status: "kept",
          keptAt: nowIso,
          revertedAt: null,
          appliedCommitId: commitId,
        });
      });

      if (!kept) throw new Error("adaptation keep did not persist");
      return {
        adaptation: kept,
        commit: {
          commitId,
          status: "committed",
          entries: [],
          progressEffects: [],
          coachNoteId: null,
          undoExpiresAt,
        },
      };
    });
  }

  async function undoLatest(input: { commitId: string; now: string }): Promise<UndoResult> {
    return withLock(async () => {
      const envelope = await repos.commits.commits.byId(input.commitId);
      if (!envelope) {
        throw new UndoNotAvailableError(`commit ${input.commitId} not found`);
      }
      if (envelope.status !== "committed") {
        throw new UndoNotAvailableError(`commit ${input.commitId} is ${envelope.status}, not undoable`);
      }
      if (Date.parse(input.now) >= Date.parse(envelope.undoExpiresAt)) {
        throw new UndoNotAvailableError(`commit ${input.commitId} undo window has expired`);
      }
      const allCommitted = (await repos.commits.commits.list({})).filter((c) => c.status === "committed");
      // At most one `committed` batch exists at a time (each commit supersedes the prior),
      // so the second-precision `createdAt` sort is a defensive tiebreak, never load-bearing.
      const latest = allCommitted.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!latest || latest.id !== input.commitId) {
        throw new UndoNotAvailableError(`commit ${input.commitId} is not the latest committed batch`);
      }

      const rows = (await repos.commits.rows.list({})).filter((r) => r.commitId === input.commitId);
      const restoredEntryIds: string[] = [];
      const removedEntryIds: string[] = [];

      await repos.transaction(async () => {
        // Reverse in reverse order so children go before parents.
        for (const row of rows.slice().reverse()) {
          const repo = repoForEntryKind(repos, row.entryKind);
          if (!repo) {
            continue;
          }
          if (row.operation === "create") {
            await repo.softDelete(row.entryId);
            removedEntryIds.push(row.entryId);
          } else if (row.operation === "update" && row.beforeJson) {
            await repo.update(row.entryId, businessColumns(row.beforeJson.columns));
            restoredEntryIds.push(row.entryId);
          }
        }
        // A kept adaptation is coherent only while its plan-patch commit is
        // active. Undoing that latest patch restores the plan snapshot above and
        // makes the visible adaptation explicitly reverted in the same transaction.
        const linkedAdaptations = (await repos.coach.adaptations.list({})).filter(
          (adaptation) => adaptation.status === "kept" && adaptation.appliedCommitId === input.commitId,
        );
        for (const adaptation of linkedAdaptations) {
          await repos.coach.adaptations.update(adaptation.id, {
            status: "reverted",
            revertedAt: input.now,
            appliedCommitId: null,
          });
        }
        await repos.commits.markUndone(input.commitId, input.now);
      });

      return {
        commitId: input.commitId,
        restoredEntryIds,
        removedEntryIds,
        staleCoachNoteStalenessKey: `commit:${input.commitId}`,
      };
    });
  }

  return { commit, applyAdaptationPlanPatch, undoLatest };
}
