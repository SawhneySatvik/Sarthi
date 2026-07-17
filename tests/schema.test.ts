/**
 * tests/schema.test.ts — pure descriptor assertions over the schema contract.
 * No DB, no network. Enforces the locked invariants at the contract layer:
 * per-user scoping, integer money, and a framework-free contract module.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";

import { allTableDescriptors, schemaContract } from "../data/schema/contract";

const EXPECTED_TABLE_COUNT = 33;

// Descriptor assertions are pure and offline; prove it by making any fetch throw.
const savedFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (async () => {
    throw new Error("schema descriptor checks must not call fetch");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

test("the contract declares exactly 33 tables", () => {
  assert.equal(allTableDescriptors.length, EXPECTED_TABLE_COUNT);
  assert.equal(Object.keys(schemaContract).length, EXPECTED_TABLE_COUNT);
});

test("every table carries a NOT NULL userId for per-user scoping (D-2)", () => {
  for (const descriptor of allTableDescriptors) {
    const userId = descriptor.columns.find((column) => column.name === "userId");
    assert.ok(userId, `table "${descriptor.name}" is missing a userId column`);
    assert.equal(
      userId.notNull,
      true,
      `table "${descriptor.name}" userId must be NOT NULL`,
    );
  }
});

test("profiles keys on userId (its primary key) and it is NOT NULL", () => {
  const profiles = schemaContract.profiles.descriptor;
  assert.deepEqual(profiles.primaryKey, ["userId"]);
  const userId = profiles.columns.find((column) => column.name === "userId");
  assert.ok(userId);
  assert.equal(userId.notNull, true);
});

test("every *Paise column is an integer — money never floats (invariant 2)", () => {
  const paiseColumns = allTableDescriptors.flatMap((descriptor) =>
    descriptor.columns
      .filter((column) => /Paise$/.test(column.name))
      .map((column) => ({ table: descriptor.name, column })),
  );
  assert.ok(
    paiseColumns.length > 0,
    "expected at least one *Paise money column in the contract",
  );
  for (const { table, column } of paiseColumns) {
    assert.equal(
      column.type,
      "integer",
      `${table}.${column.name} money must be integer paise, got ${column.type}`,
    );
  }
});

test("transactions declares its three per-user query indexes", () => {
  const transactions = schemaContract.transactions.descriptor;
  assert.deepEqual(transactions.primaryKey, ["id"]);
  assert.deepEqual(transactions.unique, []);
  assert.deepEqual(transactions.indexes, [
    ["userId", "localDate"],
    ["userId", "categoryId", "localDate"],
    ["userId", "recurringRuleId"],
  ]);
  assert.equal(transactions.indexes.length, 3);
});

test("billing_events uniqueness is global (provider,providerEventId) — no userId", () => {
  const billing = schemaContract.billing_events.descriptor;
  assert.deepEqual(billing.unique, [["provider", "providerEventId"]]);
  // The idempotency key intentionally excludes userId (webhook replay).
  for (const constraint of billing.unique) {
    assert.ok(
      !constraint.includes("userId"),
      "billing_events idempotency unique must not include userId",
    );
  }
});

test("the contract module stays drizzle- and framework-free (D-B / invariant 9)", () => {
  const source = readFileSync("data/schema/contract.ts", "utf8");

  // Banned by *prefix*, so a subpath (e.g. "drizzle-orm/sqlite-core") is caught
  // as well as a bare specifier. Both quote styles, and every way a specifier can
  // enter the module: static/dynamic `import`, `require(...)`, and re-export
  // (`export … from`) — all of which land a module specifier right after a
  // `from` / `import` / `require` token.
  const BANNED_PREFIXES = ["drizzle-orm", "next", "react", "@ai-sdk"];
  const specifierRe = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g;

  const violations: string[] = [];
  for (const match of source.matchAll(specifierRe)) {
    const specifier = match[1];
    const banned = BANNED_PREFIXES.find((prefix) => specifier.startsWith(prefix));
    if (banned) {
      violations.push(`${specifier} (banned prefix "${banned}")`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `contract.ts must not import framework/ORM modules: ${violations.join(", ")}`,
  );
});
