/**
 * tests/coach-memory.test.ts — COACH-1 two-layer memory: the pure frecency helper
 * (`core/coach/memory.ts`) + the durable `coach_memory` repository over a MIGRATED
 * in-memory db. Every time-dependent assertion runs against a CONTROLLED clock
 * (`NOW`) so ranking is deterministic and keyless. Network-free — fetch throws for
 * the whole file.
 *
 * The headline property proven here (the seed of the `pinnedGoalRetention` eval): a
 * pinned goal is ALWAYS included and out-ranks any unpinned row at any age or K — the
 * LRU goal-eviction anti-pattern is dead by construction.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";

import {
  PINNED_FLOOR,
  TOP_K,
  bumpMemoryUsage,
  frecencyScore,
  selectMemories,
} from "../core/coach/memory";
import type { AuthenticatedUser, UserScopedRepositories } from "../core/contracts";
import type { CoachMemoryCreate, CoachMemoryRecord } from "../data/schema/contract";

import { createMemoryDb } from "./helpers/memory-db";

const USER_A: AuthenticatedUser = { userId: "user-a", email: null, mode: "local" };
const USER_B: AuthenticatedUser = { userId: "user-b", email: null, mode: "local" };

/** A fixed, controlled clock — all frecency math is a pure function of (rows, NOW). */
const NOW = new Date("2026-07-21T00:00:00.000Z");

const savedFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (async () => {
    throw new Error("coach-memory tests must not call fetch");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

/** ISO timestamp `n` days before NOW (negative `n` → the future). */
function daysFromNow(n: number): string {
  return new Date(NOW.getTime() + n * 86_400_000).toISOString();
}

/** A full in-memory memory record for the PURE `frecencyScore` unit tests (no DB). */
function record(partial: Partial<CoachMemoryRecord>): CoachMemoryRecord {
  return {
    id: partial.id ?? randomUUID(),
    userId: partial.userId ?? "u",
    createdAt: partial.createdAt ?? NOW.toISOString(),
    domain: partial.domain ?? "global",
    kind: partial.kind ?? "goal",
    text: partial.text ?? "",
    pinned: partial.pinned ?? false,
    useCount: partial.useCount ?? 0,
    lastUsedAt: partial.lastUsedAt === undefined ? null : partial.lastUsedAt,
    sourceCaptureId: partial.sourceCaptureId === undefined ? null : partial.sourceCaptureId,
    estimated: partial.estimated ?? false,
    confidenceBps: partial.confidenceBps ?? 10000,
    retired: partial.retired ?? false,
  };
}

async function freshRepos(user: AuthenticatedUser): Promise<UserScopedRepositories> {
  const { db } = await createMemoryDb();
  const { createRepositoryFactory } = await import("../data/repository");
  return createRepositoryFactory(db).forUser(user);
}

/** Both users over ONE shared migrated db — for cross-tenant isolation. */
async function sharedRepos(): Promise<{ a: UserScopedRepositories; b: UserScopedRepositories }> {
  const { db } = await createMemoryDb();
  const { createRepositoryFactory } = await import("../data/repository");
  const factory = createRepositoryFactory(db);
  return { a: factory.forUser(USER_A), b: factory.forUser(USER_B) };
}

type MemoryInput = Omit<CoachMemoryCreate, "userId">;
function mem(overrides: Partial<MemoryInput> & Pick<MemoryInput, "domain" | "kind" | "text">): MemoryInput {
  return { estimated: false, confidenceBps: 10000, ...overrides };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure frecencyScore
 * ──────────────────────────────────────────────────────────────────────────── */

test("frecencyScore ranks recent+frequent above old+rare", () => {
  const recent = record({ lastUsedAt: daysFromNow(1), useCount: 12 });
  const old = record({ lastUsedAt: daysFromNow(120), useCount: 0 });
  assert.ok(
    frecencyScore(recent, NOW) > frecencyScore(old, NOW),
    "a recently + frequently used memory must out-rank a stale, rarely used one",
  );
});

test("a non-pinned score is strictly below the pinned floor at any age/frequency", () => {
  const freshFrequent = record({ lastUsedAt: NOW.toISOString(), useCount: 1_000_000 });
  const future = record({ lastUsedAt: daysFromNow(-30), useCount: 1_000_000 }); // Δdays clamps to 0
  assert.ok(frecencyScore(freshFrequent, NOW) < PINNED_FLOOR, "fresh+frequent stays < 1.0");
  assert.ok(frecencyScore(future, NOW) < PINNED_FLOOR, "future-dated row clamps and stays < 1.0");
});

test("a pinned row is the hard floor and out-ranks any unpinned row at any age", () => {
  const pinnedAncient = record({ pinned: true, lastUsedAt: daysFromNow(500), useCount: 0 });
  const unpinnedPeak = record({ pinned: false, lastUsedAt: NOW.toISOString(), useCount: 1_000_000 });
  assert.equal(frecencyScore(pinnedAncient, NOW), PINNED_FLOOR, "pinned → hard floor 1.0");
  assert.ok(
    frecencyScore(pinnedAncient, NOW) > frecencyScore(unpinnedPeak, NOW),
    "an old pinned goal must out-rank the strongest possible unpinned row",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * selectMemories
 * ──────────────────────────────────────────────────────────────────────────── */

test("selectMemories returns ALL pinned rows unconditionally, undomained", async () => {
  const repos = await freshRepos(USER_A);
  // A pinned MONEY goal must survive a HEALTH-domain turn — the whole point of the floor.
  const goal = await repos.coach.memory.create(
    mem({ domain: "money", kind: "goal", text: "Save 500000 paise/month", pinned: true, lastUsedAt: daysFromNow(400) }),
  );
  await repos.coach.memory.create(mem({ domain: "health", kind: "observation", text: "sleeps late", lastUsedAt: daysFromNow(2) }));

  const { pinned, ranked } = await selectMemories({ repos, domains: ["health"], now: NOW });
  assert.equal(pinned.length, 1, "the pinned money goal is included on a health turn");
  assert.equal(pinned[0].id, goal.id);
  assert.ok(!ranked.some((r) => r.id === goal.id), "a pinned row is never double-counted in ranked");
});

test("selectMemories filters non-pinned to the given domains with global always eligible", async () => {
  const repos = await freshRepos(USER_A);
  const health = await repos.coach.memory.create(mem({ domain: "health", kind: "struggle", text: "skips workouts", lastUsedAt: daysFromNow(1) }));
  const global = await repos.coach.memory.create(mem({ domain: "global", kind: "preference", text: "prefers mornings", lastUsedAt: daysFromNow(1) }));
  const money = await repos.coach.memory.create(mem({ domain: "money", kind: "commitment", text: "no eating out", lastUsedAt: daysFromNow(1) }));

  const { ranked } = await selectMemories({ repos, domains: ["health"], now: NOW });
  const ids = ranked.map((r) => r.id);
  assert.ok(ids.includes(health.id), "the health memory is eligible");
  assert.ok(ids.includes(global.id), "a global memory is always eligible");
  assert.ok(!ids.includes(money.id), "an off-domain (money) memory is excluded on a health turn");
});

test("selectMemories excludes retired rows and caps non-pinned at K", async () => {
  const repos = await freshRepos(USER_A);
  // 5 active non-pinned health rows at descending recency + 1 retired.
  const created: CoachMemoryRecord[] = [];
  for (let i = 0; i < 5; i++) {
    created.push(
      await repos.coach.memory.create(
        mem({ domain: "health", kind: "observation", text: `note ${i}`, useCount: 10 - i, lastUsedAt: daysFromNow(i + 1) }),
      ),
    );
  }
  const retired = await repos.coach.memory.create(mem({ domain: "health", kind: "observation", text: "gone", lastUsedAt: daysFromNow(1) }));
  await repos.coach.memory.update(retired.id, { retired: true });

  const { ranked } = await selectMemories({ repos, domains: ["health"], now: NOW, k: 2 });
  assert.equal(ranked.length, 2, "K cutoff caps the non-pinned set");
  assert.equal(ranked[0].id, created[0].id, "the most recent/frequent row ranks first");
  assert.equal(ranked[1].id, created[1].id, "then the next by frecency");
  assert.ok(!ranked.some((r) => r.id === retired.id), "retired rows are never selected");
});

test("the pinned goal survives even with >K seeded memories and k=1", async () => {
  const repos = await freshRepos(USER_A);
  const goal = await repos.coach.memory.create(
    mem({ domain: "health", kind: "goal", text: "run a half marathon", pinned: true, lastUsedAt: daysFromNow(300) }),
  );
  for (let i = 0; i < TOP_K + 4; i++) {
    await repos.coach.memory.create(mem({ domain: "health", kind: "observation", text: `n${i}`, lastUsedAt: daysFromNow(i + 1) }));
  }
  const { pinned, ranked } = await selectMemories({ repos, domains: ["health"], now: NOW, k: 1 });
  assert.ok(pinned.some((r) => r.id === goal.id), "pinned is not subject to K");
  assert.equal(ranked.length, 1, "ranked still honours k=1");
});

/* ────────────────────────────────────────────────────────────────────────────
 * Bookkeeping + audit + scope
 * ──────────────────────────────────────────────────────────────────────────── */

test("bumpMemoryUsage increments useCount and stamps lastUsedAt (content untouched)", async () => {
  const repos = await freshRepos(USER_A);
  const row = await repos.coach.memory.create(mem({ domain: "skills", kind: "commitment", text: "practice daily" }));
  assert.equal(row.useCount, 0);
  assert.equal(row.lastUsedAt, null);

  await bumpMemoryUsage({ repos, memories: [row, row], now: NOW });

  const after = await repos.coach.memory.byId(row.id);
  assert.ok(after);
  assert.equal(after.useCount, 1, "deduped: a row listed twice bumps only once");
  assert.equal(after.lastUsedAt, NOW.toISOString(), "lastUsedAt is stamped from the controlled clock");
  assert.equal(after.text, "practice daily", "content is never mutated by bookkeeping");
  assert.equal(after.kind, "commitment");
  assert.equal(after.domain, "skills");
});

test("the bounded update surface cannot mutate content (text/kind/domain immutable)", async () => {
  const repos = await freshRepos(USER_A);
  const row = await repos.coach.memory.create(mem({ domain: "money", kind: "goal", text: "original" }));
  // Force a poisoned patch past the port type; the Zod bound strips it.
  await repos.coach.memory.update(row.id, { pinned: true, text: "HACKED", kind: "struggle" } as never);
  const after = await repos.coach.memory.byId(row.id);
  assert.ok(after);
  assert.equal(after.pinned, true, "the bounded field applied");
  assert.equal(after.text, "original", "text is immutable post-create");
  assert.equal(after.kind, "goal", "kind is immutable post-create");
});

test("coach_memory_audit appends a provenance trail and is queryable", async () => {
  const repos = await freshRepos(USER_A);
  const row = await repos.coach.memory.create(mem({ domain: "health", kind: "goal", text: "sleep 8h" }));
  await repos.coach.memoryAudit.create({ memoryId: row.id, kind: "created", confidenceTier: "high", source: "converse" });
  await repos.coach.memoryAudit.create({ memoryId: row.id, kind: "pinned", confidenceTier: "high", source: "user" });

  const all = await repos.coach.memoryAudit.list({ memoryId: row.id });
  assert.equal(all.length, 2, "both audit rows are recorded");
  const created = await repos.coach.memoryAudit.list({ kind: "created" });
  assert.equal(created.length, 1);
  assert.equal(created[0].source, "converse");
});

test("selectMemories and the memory repo are strictly tenant-scoped", async () => {
  const { a, b } = await sharedRepos();
  await a.coach.memory.create(mem({ domain: "money", kind: "goal", text: "A's pinned goal", pinned: true }));
  await a.coach.memory.create(mem({ domain: "health", kind: "observation", text: "A's note" }));

  const bView = await selectMemories({ repos: b, domains: ["health", "money"], now: NOW });
  assert.equal(bView.pinned.length, 0, "user B never sees user A's pinned rows");
  assert.equal(bView.ranked.length, 0, "user B never sees user A's ranked rows");
  assert.equal((await b.coach.memory.list({})).length, 0, "user B's list is empty");

  const aView = await selectMemories({ repos: a, domains: ["health", "money"], now: NOW });
  assert.equal(aView.pinned.length, 1, "user A still sees their own rows");
});
