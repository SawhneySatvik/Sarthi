/** Shared-contract row codec for SQLite's integer / text representation. */
import {
  schemaContract,
  type ColumnDescriptor,
  type TableName,
} from "@schema/contract";

import type { SqlitePrimitive, SqliteRow } from "./types";

type RecordRow = Record<string, unknown>;

function descriptorFor(table: TableName, column: string): ColumnDescriptor | undefined {
  return schemaContract[table].descriptor.columns.find((entry) => entry.name === column);
}

export function encodeValue(column: ColumnDescriptor | undefined, value: unknown): SqlitePrimitive {
  if (value === undefined || value === null) return null;
  if (column?.type === "boolean") return value ? 1 : 0;
  if (column?.type === "json") return JSON.stringify(value);
  if (typeof value === "string" || typeof value === "number") return value;
  throw new TypeError(`Unsupported SQLite value for ${column?.name ?? "unknown column"}`);
}

export function encodeRow(table: TableName, row: RecordRow): SqliteRow {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [column, encodeValue(descriptorFor(table, column), value)]),
  );
}

export function decodeRow<T>(table: TableName, row: SqliteRow): T {
  const decoded: RecordRow = {};
  for (const [column, value] of Object.entries(row)) {
    const descriptor = descriptorFor(table, column);
    if (value === null) {
      decoded[column] = null;
    } else if (descriptor?.type === "boolean") {
      decoded[column] = value === 1 || value === "1";
    } else if (descriptor?.type === "json") {
      decoded[column] = typeof value === "string" ? JSON.parse(value) : value;
    } else {
      decoded[column] = value;
    }
  }
  return decoded as T;
}

export function encodeCondition(
  table: TableName,
  column: string,
  value: unknown,
): SqlitePrimitive {
  return encodeValue(descriptorFor(table, column), value);
}
