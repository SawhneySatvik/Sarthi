/**
 * tests/migrations.test.ts — migration smoke: apply the committed SQL to an
 * in-memory SQLite DB and assert the resulting shape. No drizzle-kit invocation;
 * keyless and network-free (fetch is overridden to throw for the whole file).
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type { Row } from "@libsql/client";

import { createMemoryDb, type MemoryDb } from "./helpers/memory-db";

const EXPECTED_TABLE_COUNT = 38;

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

test("the committed migration creates all 38 domain tables", async () => {
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
      "daily_reflections",
      "reflection_media",
      "coach_messages",
      "coach_memory",
      "coach_memory_audit",
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

test("adaptations migration carries the nullable appliedCommitId linkage", async () => {
  const memory = await createMemoryDb();
  try {
    const info = await memory.client.execute("PRAGMA table_info(adaptations)");
    const column = info.rows.find((row: Row) => String(row.name) === "appliedCommitId");
    assert.ok(column, "adaptations.appliedCommitId is required for undo coherence");
    assert.equal(Number(column.notnull), 0, "proposal rows must keep this linkage nullable");
  } finally {
    memory.client.close();
  }
});

test("0006 creates the three coach-memory tables with their columns", async () => {
  const memory = await createMemoryDb();
  try {
    const columnsOf = async (table: string): Promise<Map<string, Row>> => {
      const info = await memory.client.execute(`PRAGMA table_info(${table})`);
      return new Map(info.rows.map((row: Row) => [String(row.name), row]));
    };

    // coach_messages — immutable turn buffer; model columns are nullable (user rows).
    const messages = await columnsOf("coach_messages");
    for (const col of ["role", "text", "localDate", "toolLogJson", "proposedAdaptationId", "modelProvider", "modelId"]) {
      assert.ok(messages.has(col), `coach_messages must carry ${col}`);
    }
    assert.equal(Number(messages.get("modelId")!.notnull), 0, "modelId is null for user rows");
    assert.equal(Number(messages.get("modelProvider")!.notnull), 0, "modelProvider is null for user rows");

    // coach_memory — durable memory; integer basis points, bounded lifecycle fields.
    const mem = await columnsOf("coach_memory");
    for (const col of ["domain", "kind", "text", "pinned", "useCount", "lastUsedAt", "sourceCaptureId", "estimated", "confidenceBps", "retired"]) {
      assert.ok(mem.has(col), `coach_memory must carry ${col}`);
    }
    assert.equal(Number(mem.get("confidenceBps")!.notnull), 1, "confidenceBps is NOT NULL (integer basis points)");
    assert.equal(Number(mem.get("pinned")!.notnull), 1, "pinned is NOT NULL");
    assert.equal(Number(mem.get("useCount")!.notnull), 1, "useCount is NOT NULL");

    // coach_memory_audit — append-only provenance ledger.
    const audit = await columnsOf("coach_memory_audit");
    for (const col of ["memoryId", "kind", "confidenceTier", "source"]) {
      assert.ok(audit.has(col), `coach_memory_audit must carry ${col}`);
    }
  } finally {
    memory.client.close();
  }
});

test("0006 declares the coach-memory scoping indexes", async () => {
  const memory = await createMemoryDb();
  try {
    const result = await memory.client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'index'",
    );
    const indexNames = result.rows.map((row: Row) => String(row.name));
    for (const expected of [
      "coach_messages_userId_createdAt_idx",
      "coach_memory_userId_domain_idx",
      "coach_memory_userId_pinned_idx",
      "coach_memory_audit_userId_memoryId_idx",
      "coach_memory_audit_userId_createdAt_idx",
    ]) {
      assert.ok(indexNames.includes(expected), `missing coach-memory index "${expected}"`);
    }
  } finally {
    memory.client.close();
  }
});
