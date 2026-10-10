/**
 * tests/mcp-todos.test.ts — the todo layer (overall-arc milestones). Keyless.
 * add + dedup · complete (id/title) · never creates on complete · a foreign/non-todo id is refused ·
 * multi-user isolation + a brand-new space can add a todo · rollover carries an open todo and
 * still rolls the rest of the arc · todos ride on every SarthiState via `safely`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createCommitService } from "../core/capture";
import type { UserScopedRepositories } from "../core/contracts";
import { ensurePlanRolledOver } from "../core/plan/rollover";
import { createRepositoryFactory } from "../data/repository";
import { addTodoTool, completeTodoTool } from "../mcp/todo-tools";
import { NO_ARC_MESSAGE } from "../mcp/todos";
import { deriveCardKey, ensureProvisioned, getToday, safely, userKeyForSubject, type ToolContext } from "../mcp/tools";
import { createLlmGateway } from "../providers";
import { createFakeDecisionProvider } from "../providers/decisions";
import { createMemoryDb } from "./helpers/memory-db";

const TZ = "Asia/Kolkata";
const NOW = "2026-10-10T06:00:00.000Z"; // 2026-10-10 in IST
const TOMORROW = "2026-10-11T06:00:00.000Z";

function ctxFor(repos: UserScopedRepositories, userId: string, now = NOW): ToolContext {
  return {
    repos,
    service: createCommitService({ repos, llm: createLlmGateway("fake") }),
    userId,
    log: () => undefined,
    logError: () => undefined,
    cardKey: deriveCardKey("t"),
    requireCardToken: true,
    timezoneOverride: TZ,
    fallbackTimezone: TZ,
    now: () => now,
    decisions: createFakeDecisionProvider(),
  };
}

async function localWorld({ withArc = true } = {}) {
  const { db } = await createMemoryDb();
  const factory = createRepositoryFactory(db);
  const repos = factory.forUser({ userId: "local-dev", email: null, mode: "local" });
  let arcId: string | null = null;
  if (withArc) {
    const arc = await repos.plans.arcs.create({ domain: "overall", mode: "build", title: "First 30 days", startDate: "2026-10-09", endDate: null, dayNumber: 2, status: "active" });
    arcId = arc.id;
  }
  return { factory, repos, arcId, ctx: ctxFor(repos, "local-dev") };
}

const planItems = async (repos: UserScopedRepositories) => repos.plans.items.list({});

test("add_todo files overall/milestone rows for today and dedups case-insensitively", async () => {
  const { repos, ctx, arcId } = await localWorld();
  const first = await addTodoTool(ctx, { titles: ["Call the bank", "  call THE bank ", "Book dentist"] });
  assert.deepEqual(first.structuredContent.todos?.map((t) => [t.title, t.status]), [
    ["Call the bank", "pending"],
    ["Book dentist", "pending"],
  ]);
  const again = await addTodoTool(ctx, { titles: ["BOOK DENTIST"] });
  assert.match(again.structuredContent.message, /Already on today's list/);
  const rows = await planItems(repos);
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.arcId, arcId);
    assert.equal(row.domain, "overall");
    assert.equal(row.kind, "milestone");
    assert.equal(row.localDate, "2026-10-10");
    assert.equal(row.completionSource, null);
  }
  assert.equal((await repos.plans.progress.list({})).length, 0, "no XP for todos");
});

test("complete_todo by title/id; never creates; refuses a non-todo plan item id", async () => {
  const { repos, ctx, arcId } = await localWorld();
  await addTodoTool(ctx, { titles: ["Call the bank", "Book dentist"] });
  const byTitle = await completeTodoTool(ctx, { title: "call the BANK" });
  assert.match(byTitle.structuredContent.message, /Marked "Call the bank" done/);
  const bank = (await planItems(repos)).find((r) => r.title === "Call the bank");
  assert.equal(bank?.status, "done");
  assert.equal(bank?.completionSource, "manual");

  const before = (await planItems(repos)).length;
  const unknown = await completeTodoTool(ctx, { title: "Water the plants" });
  assert.match(unknown.structuredContent.message, /No open to-do matched — nothing was changed/);
  assert.equal((await planItems(repos)).length, before, "complete never creates");

  const task = await repos.plans.items.create({ arcId: arcId!, domain: "health", kind: "task", title: "Log lunch", dueAt: null, localDate: "2026-10-10", targetValue: null, targetUnit: null, status: "pending", completionSource: null, ruleJson: null, linkedHabitId: null, linkedSkillId: null });
  await completeTodoTool(ctx, { todoId: task.id });
  assert.equal((await repos.plans.items.byId(task.id))?.status, "pending", "a real-domain plan item is not a todo");

  const dentist = (await planItems(repos)).find((r) => r.title === "Book dentist")!;
  await completeTodoTool(ctx, { todoId: dentist.id });
  assert.equal((await repos.plans.items.byId(dentist.id))?.status, "done");
  const twice = await completeTodoTool(ctx, { todoId: dentist.id });
  assert.match(twice.structuredContent.message, /already done/);
});

test("complete_todo: a Luna-only match suggests and never writes", async () => {
  const { repos, ctx } = await localWorld();
  await addTodoTool(ctx, { titles: ["Read 10 pages of DDIA"] });
  const luna = { name: "openai" as const, async decide(_i: string, qs: { name: string }[]) {
    return qs.map((q) => ({ type: "choice" as const, name: q.name, choice: "Read 10 pages of DDIA", confidence: 0.97, source: "live" as const }));
  } };
  const res = await completeTodoTool({ ...ctx, decisions: luna }, { title: "read ddia" });
  assert.equal(res.isError, undefined);
  assert.equal(
    res.structuredContent.message,
    'Did you mean "Read 10 pages of DDIA"? Say "done with Read 10 pages of DDIA" or tap Done in the Sarthi panel. Nothing was changed.',
  );
  assert.deepEqual(res.structuredContent.todos?.map((t) => t.status), ["pending"]);
  assert.deepEqual((await planItems(repos)).map((r) => r.status), ["pending"], "nothing written");
});

test("single-user with no overall arc → friendly message, nothing created", async () => {
  const { repos, ctx } = await localWorld({ withArc: false });
  const res = await addTodoTool(ctx, { titles: ["Call the bank"] });
  assert.equal(res.structuredContent.message, NO_ARC_MESSAGE);
  assert.equal((await planItems(repos)).length, 0);
  assert.equal((await repos.plans.arcs.list({})).length, 0);
});

test("multi-user: a brand-new space can add a todo; spaces are isolated", async () => {
  const { factory } = await localWorld({ withArc: false });
  const space = async (subject: string) => {
    const { userId } = userKeyForSubject(subject);
    const repos = factory.forUser({ userId, email: null, mode: "local" });
    await ensureProvisioned(repos, userId, TZ);
    return { repos, ctx: ctxFor(repos, userId) };
  };
  const a = await space("subject-A");
  const b = await space("subject-B");
  const arcs = await a.repos.plans.arcs.list({});
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].domain, "overall");
  assert.equal(arcs[0].endDate, null);

  const added = await addTodoTool(a.ctx, { titles: ["Renew passport"] });
  assert.deepEqual(added.structuredContent.todos?.map((t) => t.title), ["Renew passport"]);
  const bView = await safely(b.ctx, "get_today", () => getToday(b.ctx));
  assert.deepEqual(bView.structuredContent.todos, [], "B never sees A's todos");
  const aId = added.structuredContent.todos![0].id;
  await completeTodoTool(b.ctx, { todoId: aId });
  assert.equal((await a.repos.plans.items.byId(aId))?.status, "pending", "B cannot complete A's todo");

  // A space provisioned before this change (no arc) gets one lazily on the first add.
  const { userId } = userKeyForSubject("subject-old");
  const oldRepos = factory.forUser({ userId, email: null, mode: "local" });
  const oldCtx = ctxFor(oldRepos, userId);
  const lazy = await addTodoTool(oldCtx, { titles: ["First todo"] });
  assert.deepEqual(lazy.structuredContent.todos?.map((t) => t.title), ["First todo"]);
});

test("rollover: the arc still rolls when a todo lands first; an open todo carries, a done one doesn't", async () => {
  const { repos, arcId } = await localWorld();
  const yesterdayTask = await repos.plans.items.create({ arcId: arcId!, domain: "health", kind: "task", title: "Log lunch", dueAt: null, localDate: "2026-10-09", targetValue: null, targetUnit: null, status: "pending", completionSource: null, ruleJson: null, linkedHabitId: null, linkedSkillId: null });
  const ctx = ctxFor(repos, "local-dev");
  await addTodoTool(ctx, { titles: ["Open todo", "Done todo"] });
  assert.equal((await repos.plans.items.byId(yesterdayTask.id))?.status, "missed");
  const today = (await planItems(repos)).filter((r) => r.localDate === "2026-10-10");
  assert.deepEqual(today.map((r) => r.title).sort(), ["Done todo", "Log lunch", "Open todo"]);
  await completeTodoTool(ctx, { title: "Done todo" });

  await ensurePlanRolledOver(repos, { timezone: TZ, nowIso: TOMORROW });
  const tomorrow = (await planItems(repos)).filter((r) => r.localDate === "2026-10-11");
  assert.deepEqual(tomorrow.map((r) => `${r.title}:${r.status}`).sort(), ["Log lunch:pending", "Open todo:pending"]);
  const view = await safely(ctxFor(repos, "local-dev", TOMORROW), "get_today", () => getToday(ctxFor(repos, "local-dev", TOMORROW)));
  assert.deepEqual(view.structuredContent.todos?.map((t) => t.title), ["Open todo"]);
});
