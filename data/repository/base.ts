/**
 * data/repository/base.ts — descriptor-driven generic repositories.
 *
 * Two primitives satisfy the ports in `core/contracts/repositories`:
 *   - `createScopedRepository`     → mutable per-domain tables (full CRUD + soft delete)
 *   - `createAppendOnlyRepository` → immutable/audit tables (create/byId/list only)
 *
 * Both are driven entirely BY THE TABLE DESCRIPTOR in `schemaContract`, so one
 * implementation serves every table. Special cases are handled generically:
 *   - Primary key comes from `descriptor.primaryKey`. When it is `id` (the
 *     common case) `create` generates a UUID; when it is `userId` (only
 *     `profiles`) no id is generated and the row is addressed by `ctx.userId`.
 *   - Soft-delete filtering is applied only when a `deletedAt` column exists.
 *   - `updatedAt` is stamped only when that column exists.
 *
 * SECURITY (D-D): no method accepts a caller-supplied `userId`, raw SQL, or a
 * tenant filter. `userId` is read ONLY from `ctx`. Every read/write is scoped to
 * `eq(userId, ctx.userId)`; caller-provided `userId` on create/query is ignored.
 *
 * Typing note (SAR-021): the primitives are typed concretely against the SQLite
 * executor. The query LOGIC is dialect-agnostic; the Postgres composition root
 * can bind the same primitives to its executor later. ORM-boundary casts are
 * confined to the three tiny run helpers below.
 */
import { randomUUID } from "node:crypto";

import { and, eq, isNull, getTableColumns, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

import { RepositoryError } from "@/core/contracts/errors";
import type {
  AppendOnlyRepository,
  ScopedEntityRepository,
} from "@/core/contracts/repositories";
import { schemaContract, type TableContract, type TableName } from "@/data/schema/contract";

import type { ScopeContext, SqliteExecutor } from "./scope";

/** A persisted row as a plain bag of columns — the dynamic shape all tables share. */
type Row = Record<string, unknown>;

/* ── ORM-boundary run helpers ───────────────────────────────────────────────
 * The only place casts live. The descriptor-driven primitives operate over the
 * generic `SQLiteTable` base type, so the executor's per-table builder generics
 * cannot be inferred; each helper narrows the builder to the minimal structural
 * shape it uses. Casting the builder (not the data) keeps money/quantity values
 * flowing through untouched — the Zod `create`/`update` schemas already enforced
 * integer units before we get here.
 */
interface InsertRunner {
  values(values: Row): { returning(): Promise<Row[]> };
}
interface UpdateRunner {
  set(values: Row): { where(where: SQL | undefined): { returning(): Promise<Row[]> } };
}
interface SelectRunner {
  from(table: SQLiteTable): { where(where: SQL | undefined): Promise<Row[]> };
}

async function selectRows<T>(
  executor: SqliteExecutor,
  table: SQLiteTable,
  where: SQL | undefined,
): Promise<T[]> {
  const runner = executor.select() as unknown as SelectRunner;
  const rows = await runner.from(table).where(where);
  return rows as unknown as T[];
}

async function insertRow<T>(
  executor: SqliteExecutor,
  table: SQLiteTable,
  values: Row,
): Promise<T | undefined> {
  const runner = executor.insert(table) as unknown as InsertRunner;
  const rows = await runner.values(values).returning();
  return (rows as unknown as T[])[0];
}

export async function updateRows<T>(
  executor: SqliteExecutor,
  table: SQLiteTable,
  values: Row,
  where: SQL | undefined,
): Promise<T[]> {
  const runner = executor.update(table) as unknown as UpdateRunner;
  const rows = await runner.set(values).where(where).returning();
  return rows as unknown as T[];
}

/* ── Shared internals ───────────────────────────────────────────────────────
 * Everything both primitives need, computed once from the descriptor.
 */
function repositoryInternals<TRecord, TCreate, TQuery>(
  tableName: TableName,
  table: SQLiteTable,
  ctx: ScopeContext,
) {
  const contract: TableContract = schemaContract[tableName];
  const { descriptor } = contract;
  const createSchema = contract.create;

  const columns = getTableColumns(table) as unknown as Record<string, SQLiteColumn>;

  const primaryKeyName = descriptor.primaryKey[0];
  // PK === "id" → generate a UUID on create. PK === "userId" (profiles only) →
  // the row is the tenant's singleton; never generate an id, address by userId.
  const generatesId = primaryKeyName === "id";
  const hasDeletedAt = descriptor.columns.some((column) => column.name === "deletedAt");
  const hasUpdatedAt = descriptor.columns.some((column) => column.name === "updatedAt");

  const userIdColumn = columns.userId;
  const primaryKeyColumn = columns[primaryKeyName];

  /** Base tenant scope: userId match, plus not-soft-deleted when applicable. */
  const scopeConditions = (): Array<SQL | undefined> => {
    const conditions: Array<SQL | undefined> = [eq(userIdColumn, ctx.userId)];
    if (hasDeletedAt) {
      conditions.push(isNull(columns.deletedAt));
    }
    return conditions;
  };

  /**
   * Identity predicate. For id-keyed tables it matches the PK; for the
   * userId-keyed singleton (profiles) it IGNORES the passed id and keys off
   * `ctx.userId`, so a caller can never address another tenant's row.
   */
  const keyCondition = (id: string): SQL | undefined =>
    generatesId ? eq(primaryKeyColumn, id) : eq(userIdColumn, ctx.userId);

  // The port narrows callers to `Omit<…, 'userId'>`: the tenant is never supplied
  // by callers, it is injected from `ctx` before the Zod parse below.
  const create = async (input: Omit<TCreate, "userId">): Promise<TRecord> => {
    const now = new Date().toISOString();
    // userId is sourced ONLY from ctx; any value on `input` is overwritten.
    const validated = createSchema.parse({
      ...(input as Row),
      userId: ctx.userId,
    }) as Row;

    const row: Row = { ...validated, userId: ctx.userId, createdAt: now };
    if (hasUpdatedAt) {
      row.updatedAt = now;
    }
    if (generatesId && (row.id === undefined || row.id === null)) {
      row.id = randomUUID();
    }

    const inserted = await insertRow<TRecord>(ctx.getExecutor(), table, row);
    if (!inserted) {
      throw new RepositoryError(`${tableName}: insert returned no row`);
    }
    return inserted;
  };

  const byId = async (id: string): Promise<TRecord | null> => {
    const rows = await selectRows<TRecord>(
      ctx.getExecutor(),
      table,
      and(keyCondition(id), ...scopeConditions()),
    );
    return rows[0] ?? null;
  };

  const list = async (query: Omit<TQuery, "userId">): Promise<readonly TRecord[]> => {
    const conditions = scopeConditions();
    for (const [key, value] of Object.entries((query ?? {}) as Row)) {
      if (key === "userId") {
        continue; // tenant scope is ctx-only, never from the query
      }
      if (value === undefined) {
        continue;
      }
      const column = columns[key];
      if (!column) {
        continue; // ignore query fields that are not real columns
      }
      conditions.push(eq(column, value as never));
    }
    return selectRows<TRecord>(ctx.getExecutor(), table, and(...conditions));
  };

  return {
    contract,
    columns,
    userIdColumn,
    scopeConditions,
    keyCondition,
    create,
    byId,
    list,
  };
}

/** Mutable per-domain table: create / byId / list / update / softDelete. */
export function createScopedRepository<TRecord, TCreate, TUpdate, TQuery>(
  tableName: TableName,
  table: SQLiteTable,
  ctx: ScopeContext,
): ScopedEntityRepository<TRecord, TCreate, TUpdate, TQuery> {
  const internals = repositoryInternals<TRecord, TCreate, TQuery>(tableName, table, ctx);
  const updateSchema = internals.contract.update;
  if (!updateSchema) {
    throw new RepositoryError(
      `${tableName}: no update schema — an immutable table cannot back a scoped repository`,
    );
  }
  const { userIdColumn, keyCondition, scopeConditions } = internals;
  // Only tables carrying a `deletedAt` column can be soft-deleted. `profiles`
  // (userId-keyed singleton) has none, so guard here rather than emit a `SET
  // deletedAt` against a column that does not exist.
  const hasDeletedAt = internals.contract.descriptor.columns.some(
    (column) => column.name === "deletedAt",
  );

  const update = async (id: string, patch: TUpdate): Promise<TRecord> => {
    const now = new Date().toISOString();
    const validated = updateSchema.parse(patch) as Row;
    // Identity/tenant columns are never patchable.
    delete validated.userId;
    delete validated.id;
    const setValues: Row = { ...validated, updatedAt: now };

    const rows = await updateRows<TRecord>(
      ctx.getExecutor(),
      table,
      setValues,
      and(keyCondition(id), ...scopeConditions()),
    );
    if (rows.length === 0) {
      throw new RepositoryError(
        `${tableName}: no row ${id} for this user (not found or not owned)`,
      );
    }
    return rows[0];
  };

  const softDelete = async (id: string): Promise<void> => {
    if (!hasDeletedAt) {
      throw new RepositoryError(
        `${tableName}: table has no deletedAt column and does not support soft delete`,
      );
    }
    const now = new Date().toISOString();
    await updateRows<TRecord>(
      ctx.getExecutor(),
      table,
      { deletedAt: now, updatedAt: now },
      and(keyCondition(id), eq(userIdColumn, ctx.userId)),
    );
  };

  return {
    create: internals.create,
    byId: internals.byId,
    list: internals.list,
    update,
    softDelete,
  };
}

/** Immutable/audit table: create / byId / list only — rows are never mutated. */
export function createAppendOnlyRepository<TRecord, TCreate, TQuery>(
  tableName: TableName,
  table: SQLiteTable,
  ctx: ScopeContext,
): AppendOnlyRepository<TRecord, TCreate, TQuery> {
  const internals = repositoryInternals<TRecord, TCreate, TQuery>(tableName, table, ctx);
  return {
    create: internals.create,
    byId: internals.byId,
    list: internals.list,
  };
}
