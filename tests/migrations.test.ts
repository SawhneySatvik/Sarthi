/**
 * tests/migrations.test.ts — migration smoke: apply the committed SQL to an
 * in-memory SQLite DB and assert the resulting shape. No drizzle-kit invocation;
 * keyless and network-free (fetch is overridden to throw for the whole file).
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type { Row } from "@libsql/client";

import { createMemoryDb, type MemoryDb } from "./helpers/memory-db";

const EXPECTED_TABLE_COUNT = 33;

// Prove the smoke path touches no network: any fetch is a failure for this file.
const savedFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (async () => {
    throw new Error("migration smoke must not call fetch");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

async function userTableNames(memory: MemoryDb): Promise<string[]> {
  const result = await memory.client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  return result.rows
    .map((row: Row) => String(row.name))
    .filter((name) => !name.startsWith("sqlite_") && !name.startsWith("__drizzle"))
    .sort();
}

test("the committed migration creates all 33 domain tables", async () => {
  const memory = await createMemoryDb();
  try {
    const names = await userTableNames(memory);
    assert.equal(
      names.length,
      EXPECTED_TABLE_COUNT,
      `expected ${EXPECTED_TABLE_COUNT} tables, got ${names.length}: ${names.join(", ")}`,
    );
    for (const expected of [
      "profiles",
      "transactions",
      "billing_events",
      "commit_rows",
    ]) {
      assert.ok(
        names.includes(expected),
        `missing expected table "${expected}"`,
      );
    }
  } finally {
    memory.client.close();
  }
});

test("profiles keys on userId as its primary key", async () => {
  const memory = await createMemoryDb();
  try {
    const info = await memory.client.execute("PRAGMA table_info(profiles)");
    const userId = info.rows.find((row: Row) => String(row.name) === "userId");
    assert.ok(userId, "profiles must have a userId column");
    assert.equal(Number(userId.pk), 1, "userId must be the primary key");
    assert.equal(Number(userId.notnull), 1, "userId must be NOT NULL");
    // No separate surrogate id column on the per-user singleton.
    const idColumn = info.rows.find((row: Row) => String(row.name) === "id");
    assert.equal(idColumn, undefined, "profiles must not carry a surrogate id");
  } finally {
    memory.client.close();
  }
});

test("the global billing idempotency unique index exists", async () => {
  const memory = await createMemoryDb();
  try {
    const result = await memory.client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'index'",
    );
    const indexNames = result.rows.map((row: Row) => String(row.name));
    assert.ok(
      indexNames.includes("billing_events_provider_providerEventId_uq"),
      `missing billing idempotency index; saw: ${indexNames.join(", ")}`,
    );
  } finally {
    memory.client.close();
  }
});
