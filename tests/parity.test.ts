/**
 * tests/parity.test.ts — dual-dialect schema parity + contract conformance.
 *
 * `data/schema/postgres.ts` is otherwise only tsc-checked; nothing asserts its
 * columns actually match `data/schema/sqlite.ts` or the signed descriptors in
 * `data/schema/contract.ts`. A dropped/renamed column, a nullability skew, or a
 * money column that stops being an integer in ONE dialect would compile fine and
 * ship. This test introspects both drizzle table sets (no DB, no network — pure
 * schema reflection, keyless) and fails loudly on any divergence, naming the
 * exact table/column so the schema author can fix it.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

import * as sq from "../data/schema/sqlite";
import * as pg from "../data/schema/postgres";
import { allTableDescriptors, schemaContract } from "../data/schema/contract";

const EXPECTED_TABLE_COUNT = 35;

/** Every exported drizzle table in a dialect module, keyed by its SQL name. */
function tablesBySqlName(mod: Record<string, unknown>): Map<string, Table> {
  const byName = new Map<string, Table>();
  for (const value of Object.values(mod)) {
    if (is(value, Table)) {
      const name = getTableName(value);
      assert.ok(
        !byName.has(name),
        `duplicate table SQL name "${name}" exported from one dialect`,
      );
      byName.set(name, value);
    }
  }
  return byName;
}

const sqliteTables = tablesBySqlName(sq);
const pgTables = tablesBySqlName(pg);

/** Column-name set (order-insensitive, sorted) for one drizzle table. */
function columnNames(table: Table): string[] {
  return Object.keys(getTableColumns(table)).sort();
}

/** Reflection is pure and offline — prove it by making any fetch throw. */
const savedFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (async () => {
    throw new Error("schema parity checks must not call fetch");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

test("both dialects export the same 35 tables (same SQL names)", () => {
  assert.equal(
    sqliteTables.size,
    EXPECTED_TABLE_COUNT,
    `sqlite.ts exports ${sqliteTables.size} tables, expected ${EXPECTED_TABLE_COUNT}`,
  );
  assert.equal(
    pgTables.size,
    EXPECTED_TABLE_COUNT,
    `postgres.ts exports ${pgTables.size} tables, expected ${EXPECTED_TABLE_COUNT}`,
  );

  const sqliteNames = [...sqliteTables.keys()].sort();
  const pgNames = [...pgTables.keys()].sort();
  assert.deepEqual(
    sqliteNames,
    pgNames,
    "sqlite.ts and postgres.ts export different table SQL names",
  );

  // And that shared set is exactly the contract's set.
  const contractNames = allTableDescriptors.map((d) => d.name).sort();
  assert.deepEqual(
    sqliteNames,
    contractNames,
    "dialect table set diverges from the schema contract",
  );
});

test("per-table column-name parity across dialects (order-insensitive)", () => {
  for (const [name, sqliteTable] of sqliteTables) {
    const pgTable = pgTables.get(name);
    assert.ok(pgTable, `table "${name}" exists in sqlite.ts but not postgres.ts`);
    const sqliteCols = columnNames(sqliteTable);
    const pgCols = columnNames(pgTable);
    assert.deepEqual(
      sqliteCols,
      pgCols,
      `table "${name}" columns diverge between dialects`,
    );
  }
});

test("per-column notNull parity across dialects", () => {
  for (const [name, sqliteTable] of sqliteTables) {
    const pgTable = pgTables.get(name)!;
    const sqliteCols = getTableColumns(sqliteTable) as Record<string, AnyColumn>;
    const pgCols = getTableColumns(pgTable) as Record<string, AnyColumn>;
    for (const [key, sqliteCol] of Object.entries(sqliteCols)) {
      const pgCol = pgCols[key];
      assert.ok(pgCol, `column "${name}.${key}" missing in postgres.ts`);
      assert.equal(
        sqliteCol.notNull,
        pgCol.notNull,
        `nullability mismatch at "${name}.${key}": sqlite notNull=${sqliteCol.notNull}, pg notNull=${pgCol.notNull}`,
      );
    }
  }
});

test("both dialects match the signed contract's column set per table", () => {
  for (const [name, sqliteTable] of sqliteTables) {
    const contract = schemaContract[name as keyof typeof schemaContract];
    assert.ok(contract, `dialect table "${name}" has no schemaContract descriptor`);
    const contractCols = contract.descriptor.columns.map((c) => c.name).sort();

    assert.deepEqual(
      columnNames(sqliteTable),
      contractCols,
      `sqlite.ts columns for "${name}" diverge from the contract`,
    );

    const pgTable = pgTables.get(name);
    assert.ok(pgTable, `contract table "${name}" missing from postgres.ts`);
    assert.deepEqual(
      columnNames(pgTable),
      contractCols,
      `postgres.ts columns for "${name}" diverge from the contract`,
    );
  }
});

test("every *Paise money column is an integer column in BOTH dialects (invariant 2)", () => {
  let checked = 0;
  for (const [name, sqliteTable] of sqliteTables) {
    const pgTable = pgTables.get(name)!;
    const sqliteCols = getTableColumns(sqliteTable) as Record<string, AnyColumn>;
    const pgCols = getTableColumns(pgTable) as Record<string, AnyColumn>;
    for (const [key, sqliteCol] of Object.entries(sqliteCols)) {
      if (!/Paise$/.test(sqliteCol.name)) continue;
      checked += 1;
      const pgCol = pgCols[key];
      assert.ok(pgCol, `money column "${name}.${key}" missing in postgres.ts`);

      // The point: money is an integer primitive, never text/real/numeric.
      assert.equal(
        sqliteCol.columnType,
        "SQLiteInteger",
        `${name}.${sqliteCol.name} (sqlite) must be an integer column, got ${sqliteCol.columnType}`,
      );
      assert.equal(
        pgCol.columnType,
        "PgInteger",
        `${name}.${pgCol.name} (pg) must be an integer column, got ${pgCol.columnType}`,
      );
      // dataType corroborates: a numeric primitive, not a string.
      assert.equal(sqliteCol.dataType, "number", `${name}.${sqliteCol.name} sqlite dataType`);
      assert.equal(pgCol.dataType, "number", `${name}.${pgCol.name} pg dataType`);
    }
  }
  assert.ok(checked > 0, "expected at least one *Paise money column to exist");
});
