/**
 * mcp/todos.ts — the todo layer (design "A: reuse Today tasks"). Data ops only; no tool wiring.
 *
 * A todo = a `plan_items` row on the user's active OVERALL arc: domain "overall" (never a real
 * domain — captures auto-tick matching-domain items), kind "milestone" (rollover carries an
 * incomplete milestone forward and never repeats a done one), localDate = the user's today.
 * No XP. Status changes use the same plain item update as the Today Done tap.
 */
import type { DecisionProvider, UserScopedRepositories } from "@/core/contracts";
import { ensurePlanRolledOver } from "@/core/plan/rollover";

import { lunaPickTitle, type DecisionsSummary } from "./decisions";

export type Todo = { id: string; title: string; status: string };
export interface TodoDay {
  now: string;
  timezone: string;
  localDate: string;
}

export const MAX_TODO_TITLE = 120;
export const MAX_TODOS_PER_CALL = 10;
export const NO_ARC_MESSAGE = "Set up your Sarthi day first — there's no active day plan to add to-dos to.";
const OPEN = new Set(["pending", "active"]);

/** Materialize today's plan first: a today row added before the roll would block the whole arc's roll. */
async function rollOver(repos: UserScopedRepositories, day: TodoDay): Promise<void> {
  await ensurePlanRolledOver(repos, { timezone: day.timezone, nowIso: day.now });
}

export async function activeOverallArc(repos: UserScopedRepositories) {
  return (await repos.plans.arcs.list({})).find((a) => a.domain === "overall" && a.status === "active") ?? null;
}

/** A minimal open-ended OVERALL arc (renders as an empty plan). Idempotent. Call inside a txn. */
export async function ensureOverallArc(repos: UserScopedRepositories, localDate: string): Promise<boolean> {
  if (await activeOverallArc(repos)) return false;
  await repos.plans.arcs.create({
    domain: "overall",
    mode: "build",
    title: "My days",
    startDate: localDate,
    endDate: null,
    dayNumber: 1,
    status: "active",
  });
  return true;
}

export function cleanTitle(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_TODO_TITLE);
}

async function listRaw(repos: UserScopedRepositories, localDate: string) {
  return (await repos.plans.items.list({ localDate })).filter((i) => i.domain === "overall" && i.kind === "milestone" && i.localDate === localDate);
}

/** Today's todos (rolls the plan first, best effort). */
export async function todayTodos(repos: UserScopedRepositories, day: TodoDay): Promise<Todo[]> {
  try {
    await rollOver(repos, day);
  } catch {
    /* a failed roll must not hide the list */
  }
  return (await listRaw(repos, day.localDate)).map((i) => ({ id: i.id, title: i.title, status: i.status }));
}

export interface AddTodosResult {
  added: Todo[];
  duplicates: string[];
  noArc: boolean;
}

export async function addTodos(
  repos: UserScopedRepositories,
  day: TodoDay,
  titles: readonly string[],
  options: { createArcIfMissing: boolean },
): Promise<AddTodosResult> {
  await rollOver(repos, day);
  return repos.transaction(async () => {
    let arc = await activeOverallArc(repos);
    if (!arc && options.createArcIfMissing) {
      await ensureOverallArc(repos, day.localDate);
      arc = await activeOverallArc(repos);
    }
    if (!arc) return { added: [], duplicates: [], noArc: true };
    const open = (await listRaw(repos, day.localDate)).filter((i) => OPEN.has(i.status));
    const seen = new Set(open.map((i) => i.title.toLowerCase()));
    const added: Todo[] = [];
    const duplicates: string[] = [];
    for (const raw of titles.slice(0, MAX_TODOS_PER_CALL)) {
      const title = cleanTitle(raw);
      if (!title) continue;
      if (seen.has(title.toLowerCase())) {
        duplicates.push(title);
        continue;
      }
      seen.add(title.toLowerCase());
      const row = await repos.plans.items.create({
        arcId: arc.id,
        domain: "overall",
        kind: "milestone",
        title,
        dueAt: null,
        localDate: day.localDate,
        targetValue: null,
        targetUnit: null,
        status: "pending",
        completionSource: null,
        ruleJson: null,
        linkedHabitId: null,
        linkedSkillId: null,
      });
      added.push({ id: row.id, title: row.title, status: row.status });
    }
    return { added, duplicates, noArc: false };
  });
}

export type CompleteTodoResult =
  | { outcome: "done"; todo: Todo; via: "id" | "title"; decisions: DecisionsSummary | null }
  /** Luna's guess only — nothing written; the user confirms with the exact title or a tap. */
  | { outcome: "suggest"; todo: Todo; confidence: number; decisions: DecisionsSummary | null }
  | { outcome: "already-done"; todo: Todo; decisions: DecisionsSummary | null }
  | { outcome: "not-found"; open: Todo[]; decisions: DecisionsSummary | null };

/** Mark one of TODAY's open todos done. Never creates. */
export async function completeTodo(
  repos: UserScopedRepositories,
  day: TodoDay,
  input: { todoId?: string; title?: string },
  provider: DecisionProvider,
): Promise<CompleteTodoResult> {
  await rollOver(repos, day);
  const all = await listRaw(repos, day.localDate);
  const open = all.filter((i) => OPEN.has(i.status));
  const asTodo = (i: (typeof all)[number]): Todo => ({ id: i.id, title: i.title, status: i.status });
  const finish = async (id: string, via: "id" | "title") => {
    const row = await repos.plans.items.update(id, { status: "done", completionSource: "manual" });
    return { outcome: "done" as const, todo: { id: row.id, title: row.title, status: row.status }, via, decisions: null };
  };

  if (input.todoId) {
    const hit = open.find((i) => i.id === input.todoId);
    if (hit) return finish(hit.id, "id");
    const done = all.find((i) => i.id === input.todoId && i.status === "done");
    if (done) return { outcome: "already-done", todo: asTodo(done), decisions: null };
    return { outcome: "not-found", open: open.map(asTodo), decisions: null };
  }
  const title = cleanTitle(input.title ?? "");
  if (!title) return { outcome: "not-found", open: open.map(asTodo), decisions: null };
  const exact = open.find((i) => i.title.toLowerCase() === title.toLowerCase());
  if (exact) return finish(exact.id, "title");
  const doneExact = all.find((i) => i.status === "done" && i.title.toLowerCase() === title.toLowerCase());
  if (doneExact) return { outcome: "already-done", todo: asTodo(doneExact), decisions: null };
  const pick = await lunaPickTitle(provider, title, open.map((i) => i.title));
  if (pick.title !== null) {
    const hit = open.find((i) => i.title === pick.title);
    // A fuzzy match never writes: suggest it and let the user confirm.
    if (hit) return { outcome: "suggest", todo: asTodo(hit), confidence: pick.confidence, decisions: pick.summary };
  }
  return { outcome: "not-found", open: open.map(asTodo), decisions: pick.summary };
}
