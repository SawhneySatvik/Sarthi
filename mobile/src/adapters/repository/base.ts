import { decodeRow, encodeCondition, encodeRow } from "@mobile/db/codec";
import type { SqliteCondition } from "@mobile/db/types";
import { RepositoryError } from "@contracts";
import { schemaContract, type TableName } from "@schema/contract";

import type { AppendOnlyRepository, ScopedEntityRepository } from "@contracts";

import type { NativeRepositoryScope } from "./scope";

type Row = Record<string, unknown>;

/** `satisfies Record<..., TableContract>` preserves a union at indexed access. */
interface RepositoryTableContract {
  create: { parse(input: unknown): unknown };
  update?: { parse(input: unknown): unknown };
  query: { parse(input: unknown): unknown };
}

function repositoryContract(table: TableName): RepositoryTableContract {
  return schemaContract[table] as RepositoryTableContract;
}

function tableHasColumn(table: TableName, name: string): boolean {
  return schemaContract[table].descriptor.columns.some((column) => column.name === name);
}

function tablePrimaryKey(table: TableName): string {
  return schemaContract[table].descriptor.primaryKey[0];
}

function recordId(table: TableName, row: Row, userId: string): string {
  const key = tablePrimaryKey(table);
  const id = key === "userId" ? userId : row[key];
  if (typeof id !== "string") throw new RepositoryError(`${table}: persisted row has no string ${key}`);
  return id;
}

function keyConditions(table: TableName, id: string, userId: string): SqliteCondition[] {
  const primaryKey = tablePrimaryKey(table);
  return [
    { column: "userId", value: userId },
    ...(primaryKey === "userId" ? [] : [{ column: primaryKey, value: id }]),
  ];
}

function scopedConditions(table: TableName, userId: string): SqliteCondition[] {
  return [{ column: "userId", value: userId }];
}

function activeConditions(table: TableName, conditions: SqliteCondition[]): SqliteCondition[] {
  return tableHasColumn(table, "deletedAt")
    ? [...conditions, { column: "deletedAt", value: null }]
    : conditions;
}

function queryConditions(table: TableName, query: Row, userId: string): SqliteCondition[] {
  const conditions = activeConditions(table, scopedConditions(table, userId));
  for (const [column, value] of Object.entries(query)) {
    if (column === "userId" || value === undefined || !tableHasColumn(table, column)) continue;
    conditions.push({ column, value: encodeCondition(table, column, value) });
  }
  return conditions;
}

/** SQLite materializes omitted nullable fields as NULL; mirror that explicitly
 * before an in-memory test double sees the row. */
function materializeNullableColumns(table: TableName, row: Row): Row {
  const materialized: Row = { ...row };
  for (const column of schemaContract[table].descriptor.columns) {
    if (!column.notNull && materialized[column.name] === undefined) {
      materialized[column.name] = null;
    }
  }
  return materialized;
}

/**
 * Descriptor-driven implementation for every mutable user table. It executes
 * only through the bound scope, so userId is injected from authentication and
 * cannot be supplied by a caller or used to address another tenant.
 */
export function createScopedRepository<TRecord, TCreate, TUpdate, TQuery>(
  table: TableName,
  scope: NativeRepositoryScope,
): ScopedEntityRepository<TRecord, TCreate, TUpdate, TQuery> {
  const contract = repositoryContract(table);
  if (!contract.update) {
    throw new RepositoryError(`${table}: immutable table cannot be given a mutable repository`);
  }
  const updateSchema = contract.update;

  const create = async (input: Omit<TCreate, "userId">): Promise<TRecord> => {
    const now = new Date().toISOString();
    const inputRow = input as Row;
    const candidate: Row = {
      ...inputRow,
      userId: scope.userId,
    };
    if (tablePrimaryKey(table) === "id" && (candidate.id === undefined || candidate.id === null)) {
      candidate.id = scope.nextId();
    }
    const validated = contract.create.parse(candidate) as Row;
    let row: Row = { ...validated, userId: scope.userId, createdAt: now };
    if (tableHasColumn(table, "updatedAt")) row.updatedAt = now;
    row = materializeNullableColumns(table, row);

    await scope.storage.insert(table, encodeRow(table, row));
    const record = decodeRow<TRecord>(table, encodeRow(table, row));
    await scope.record({
      table,
      id: recordId(table, row, scope.userId),
      operation: "create",
      commitStatus: table === "commits" ? String(row.status) : undefined,
    });
    return record;
  };

  const byId = async (id: string): Promise<TRecord | null> => {
    const rows = await scope.storage.select(
      table,
      activeConditions(table, keyConditions(table, id, scope.userId)),
    );
    return rows[0] ? decodeRow<TRecord>(table, rows[0]) : null;
  };

  const list = async (query: Omit<TQuery, "userId">): Promise<readonly TRecord[]> => {
    const checkedQuery = contract.query.parse({ ...((query ?? {}) as Row), userId: scope.userId }) as Row;
    const rows = await scope.storage.select(table, queryConditions(table, checkedQuery, scope.userId));
    return rows.map((row) => decodeRow<TRecord>(table, row));
  };

  const update = async (id: string, patch: TUpdate): Promise<TRecord> => {
    const validated = updateSchema.parse(patch) as Row;
    delete validated.id;
    delete validated.userId;
    if (Object.keys(validated).length === 0) {
      throw new RepositoryError(`${table}: update patch cannot be empty`);
    }
    const row: Row = { ...validated };
    if (tableHasColumn(table, "updatedAt")) row.updatedAt = new Date().toISOString();
    const conditions = activeConditions(table, keyConditions(table, id, scope.userId));
    const changed = await scope.storage.update(table, conditions, encodeRow(table, row));
    if (changed !== 1) {
      throw new RepositoryError(`${table}: no row ${id} for this user (not found or not owned)`);
    }
    const persisted = await scope.storage.select(table, conditions);
    const record = persisted[0];
    if (!record) throw new RepositoryError(`${table}: updated row ${id} could not be read`);
    await scope.record({ table, id: recordId(table, decodeRow<Row>(table, record), scope.userId), operation: "update" });
    return decodeRow<TRecord>(table, record);
  };

  const softDelete = async (id: string): Promise<void> => {
    if (!tableHasColumn(table, "deletedAt")) {
      throw new RepositoryError(`${table}: table has no deletedAt column and cannot be soft deleted`);
    }
    const patch: Row = { deletedAt: new Date().toISOString() };
    if (tableHasColumn(table, "updatedAt")) patch.updatedAt = new Date().toISOString();
    const changed = await scope.storage.update(
      table,
      keyConditions(table, id, scope.userId),
      encodeRow(table, patch),
    );
    if (changed !== 1) {
      throw new RepositoryError(`${table}: no row ${id} for this user (not found or not owned)`);
    }
    await scope.record({ table, id, operation: "softDelete" });
  };

  return { create, byId, list, update, softDelete };
}

/** Append-only tables expose no mutation surface beyond creation. */
export function createAppendOnlyRepository<TRecord, TCreate, TQuery>(
  table: TableName,
  scope: NativeRepositoryScope,
): AppendOnlyRepository<TRecord, TCreate, TQuery> {
  const contract = repositoryContract(table);
  if (contract.update) {
    throw new RepositoryError(`${table}: mutable table cannot be given an append-only repository`);
  }

  const create = async (input: Omit<TCreate, "userId">): Promise<TRecord> => {
    const now = new Date().toISOString();
    const candidate: Row = { ...(input as Row), userId: scope.userId };
    if (tablePrimaryKey(table) === "id" && (candidate.id === undefined || candidate.id === null)) {
      candidate.id = scope.nextId();
    }
    const validated = contract.create.parse(candidate) as Row;
    const row = materializeNullableColumns(table, {
      ...validated,
      userId: scope.userId,
      createdAt: now,
    });
    await scope.storage.insert(table, encodeRow(table, row));
    const record = decodeRow<TRecord>(table, encodeRow(table, row));
    await scope.record({
      table,
      id: recordId(table, row, scope.userId),
      operation: "create",
      commitStatus: table === "commits" ? String(row.status) : undefined,
    });
    return record;
  };

  const byId = async (id: string): Promise<TRecord | null> => {
    const rows = await scope.storage.select(table, keyConditions(table, id, scope.userId));
    return rows[0] ? decodeRow<TRecord>(table, rows[0]) : null;
  };

  const list = async (query: Omit<TQuery, "userId">): Promise<readonly TRecord[]> => {
    const checkedQuery = contract.query.parse({ ...((query ?? {}) as Row), userId: scope.userId }) as Row;
    const rows = await scope.storage.select(table, queryConditions(table, checkedQuery, scope.userId));
    return rows.map((row) => decodeRow<TRecord>(table, row));
  };

  return { create, byId, list };
}
