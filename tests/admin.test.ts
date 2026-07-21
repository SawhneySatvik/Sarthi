/**
 * tests/admin.test.ts — PL-2 admin waitlist seam + gate decisions, keyless and network-free.
 *
 * Covers: the 0005 status migration round-trip, the UNSCOPED admin waitlist repository over
 * memory-db, and the pure gate decisions (admin allowlist + signup approval). Fetch is stubbed to
 * throw for the whole file to prove none of it touches the network.
 */
import assert from "node:assert/strict";
import type { Row } from "@libsql/client";
import test, { after, before } from "node:test";

import {
  adminAccessAllowed,
  isAdminEmail,
  mayEmailSignUp,
  parseAdminEmails,
} from "../app/lib/admin-policy";
import { createRepositoryFactory } from "../data/repository";
import { schemaContract, waitlistStatusEnum } from "../data/schema/contract";

import { createMemoryDb } from "./helpers/memory-db";

const savedFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (async () => {
    throw new Error("admin tests must not call fetch");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

/* ── migration + contract ─────────────────────────────────────────────────── */

test("0005 migration adds waitlist.status NOT NULL DEFAULT 'pending'", async () => {
  const memory = await createMemoryDb();
  try {
    const info = await memory.client.execute("PRAGMA table_info(waitlist)");
    const status = info.rows.find((row: Row) => String(row.name) === "status");
    assert.ok(status, "waitlist must have a status column after 0005");
    assert.equal(Number(status.notnull), 1, "status must be NOT NULL");
    assert.equal(String(status.dflt_value), "'pending'", "status must default to 'pending'");
  } finally {
    memory.client.close();
  }
});

test("the contract carries the waitlist status column + the four-value enum", () => {
  const column = schemaContract.waitlist.descriptor.columns.find((c) => c.name === "status");
  assert.deepEqual(column, { name: "status", type: "text", notNull: true, enum: "waitlistStatus" });
  assert.deepEqual([...waitlistStatusEnum.options].sort(), ["approved", "invited", "pending", "rejected"]);
});

/* ── unscoped admin repository over memory-db ─────────────────────────────── */

test("admin waitlist repo enumerates ALL rows and flips status (unscoped)", async () => {
  const { db } = await createMemoryDb();
  const factory = createRepositoryFactory(db);
  const admin = factory.adminWaitlist();

  // Two DIFFERENT tenants submit — the per-tenant repo could never see both; the admin seam does.
  const reposA = factory.forUser({ userId: "tenant-A", email: null, mode: "local" });
  const reposB = factory.forUser({ userId: "tenant-B", email: null, mode: "local" });
  const a = await reposA.billing.waitlist.create({ email: "alice@example.com", source: "pricing" });
  await reposB.billing.waitlist.create({ email: "bob@example.com", source: "pricing" });

  // New rows default to pending.
  assert.equal(a.status, "pending");

  const all = await admin.listAll();
  assert.equal(all.length, 2, "admin listAll must span every tenant's rows");
  assert.deepEqual([...all.map((r) => r.email)].sort(), ["alice@example.com", "bob@example.com"]);

  // Status lookup is email-normalized (case-insensitive).
  assert.equal(await admin.statusForEmail("ALICE@example.com"), "pending");
  assert.equal(await admin.statusForEmail("nobody@example.com"), null);

  // Flip alice → approved; the change is visible by email.
  const approved = await admin.updateStatus(a.id, "approved");
  assert.equal(approved.status, "approved");
  assert.equal(await admin.statusForEmail("alice@example.com"), "approved");

  // Unknown id is a hard error, never a silent no-op.
  await assert.rejects(admin.updateStatus("does-not-exist", "invited"));
});

/* ── admin allowlist gate (pure) ──────────────────────────────────────────── */

test("parseAdminEmails normalizes, trims, and treats blank/absent as no admins", () => {
  assert.equal(parseAdminEmails(undefined).size, 0);
  assert.equal(parseAdminEmails("").size, 0);
  assert.equal(parseAdminEmails("  ,  ").size, 0);
  const set = parseAdminEmails(" Admin@Example.com , second@x.co ,");
  assert.equal(set.size, 2);
  assert.ok(isAdminEmail("admin@example.com", set));
  assert.ok(isAdminEmail("SECOND@X.CO", set));
  assert.ok(!isAdminEmail("stranger@x.co", set));
});

test("adminAccessAllowed requires supabase auth AND an allowlisted email", () => {
  const admins = parseAdminEmails("admin@example.com");
  // Happy path.
  assert.ok(adminAccessAllowed({ authProvider: "supabase", email: "admin@example.com", adminEmails: admins }));
  // Non-admin under supabase → denied.
  assert.ok(!adminAccessAllowed({ authProvider: "supabase", email: "user@example.com", adminEmails: admins }));
  // Right email but NOT real auth → denied (never reachable by the anonymous demo / local mode).
  assert.ok(!adminAccessAllowed({ authProvider: "anonymous", email: "admin@example.com", adminEmails: admins }));
  assert.ok(!adminAccessAllowed({ authProvider: "local-password", email: "admin@example.com", adminEmails: admins }));
  // No email, or empty allowlist → denied.
  assert.ok(!adminAccessAllowed({ authProvider: "supabase", email: null, adminEmails: admins }));
  assert.ok(!adminAccessAllowed({ authProvider: "supabase", email: "admin@example.com", adminEmails: parseAdminEmails("") }));
});

/* ── signup approval gate (pure) ──────────────────────────────────────────── */

test("mayEmailSignUp opens only for approved/invited — or an allowlisted admin (bootstrap)", () => {
  const admins = parseAdminEmails("boss@example.com");
  const base = { email: "user@example.com", adminEmails: admins };

  // Not on the list, or still pending / rejected → blocked.
  assert.ok(!mayEmailSignUp({ ...base, waitlistStatus: null }));
  assert.ok(!mayEmailSignUp({ ...base, waitlistStatus: "pending" }));
  assert.ok(!mayEmailSignUp({ ...base, waitlistStatus: "rejected" }));

  // Approved / invited → allowed.
  assert.ok(mayEmailSignUp({ ...base, waitlistStatus: "approved" }));
  assert.ok(mayEmailSignUp({ ...base, waitlistStatus: "invited" }));

  // Admin bootstrap: bypasses the gate regardless of waitlist status (even if never on the list).
  assert.ok(mayEmailSignUp({ email: "boss@example.com", adminEmails: admins, waitlistStatus: null }));
  assert.ok(mayEmailSignUp({ email: "BOSS@example.com", adminEmails: admins, waitlistStatus: "rejected" }));
});
