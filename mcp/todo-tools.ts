/**
 * mcp/todo-tools.ts — `add_todo` / `complete_todo` handlers + registration (model-visible).
 * Data ops live in ./todos; this file only shapes SarthiState results.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { decisionsFor } from "./decisions";
import { buildToday } from "./today";
import { addTodos, completeTodo, MAX_TODO_TITLE, MAX_TODOS_PER_CALL, NO_ARC_MESSAGE, todayTodos } from "./todos";
import { dayContext, sarthiStateShape, type SarthiState, type ToolContext, type ToolResult } from "./tools";

function state(partial: Pick<SarthiState, "today" | "message"> & Partial<SarthiState>): ToolResult {
  const s: SarthiState = { filed: [], pending: [], questions: [], lastCommitId: null, ...partial };
  return { content: [{ type: "text", text: s.message }], structuredContent: s };
}

function quoteList(titles: readonly string[]): string {
  return titles.map((t) => `"${t}"`).join(", ");
}

export async function addTodoTool(ctx: ToolContext, input: { titles: string[] }): Promise<ToolResult> {
  const day = await dayContext(ctx);
  const outcome = await addTodos(ctx.repos, day, input.titles, { createArcIfMissing: ctx.userId.startsWith("cg_") });
  const today = await buildToday(ctx.repos, day.localDate);
  const todos = await todayTodos(ctx.repos, day);
  if (outcome.noArc) return state({ today, todos, message: NO_ARC_MESSAGE });
  const parts: string[] = [];
  if (outcome.added.length) parts.push(`Added to today's to-dos: ${quoteList(outcome.added.map((t) => t.title))}.`);
  if (outcome.duplicates.length) parts.push(`Already on today's list: ${quoteList(outcome.duplicates)}.`);
  if (!parts.length) parts.push("Nothing to add.");
  ctx.log(`add_todo added=${outcome.added.length} duplicates=${outcome.duplicates.length}`);
  return state({ today, todos, message: parts.join(" ") });
}

export async function completeTodoTool(ctx: ToolContext, input: { todoId?: string; title?: string }): Promise<ToolResult> {
  const day = await dayContext(ctx);
  const outcome = await completeTodo(ctx.repos, day, input, decisionsFor(ctx.decisions, ctx.log));
  const today = await buildToday(ctx.repos, day.localDate);
  const todos = await todayTodos(ctx.repos, day);
  const decisions = outcome.decisions ?? undefined;
  ctx.log(`complete_todo outcome=${outcome.outcome}${outcome.outcome === "done" ? ` via=${outcome.via}` : ""}`);
  switch (outcome.outcome) {
    case "done":
      return state({
        today,
        todos,
        decisions,
        message: `Marked "${outcome.todo.title}" done.`,
      });
    case "suggest":
      return state({
        today,
        todos,
        decisions,
        message: `Did you mean "${outcome.todo.title}"? Say "done with ${outcome.todo.title}" or tap Done in the Sarthi panel. Nothing was changed.`,
      });
    case "already-done":
      return state({ today, todos, decisions, message: `"${outcome.todo.title}" is already done today.` });
    case "not-found":
      return state({
        today,
        todos,
        decisions,
        message: outcome.open.length
          ? `No open to-do matched — nothing was changed. Today's open to-dos: ${quoteList(outcome.open.map((t) => t.title))}.`
          : "There are no open to-dos today — nothing was changed.",
      });
  }
}

type ForRequest = (
  meta: Record<string, unknown> | undefined,
  tool: string,
  run: (ctx: ToolContext) => Promise<ToolResult>,
) => Promise<ToolResult>;

const INVOKING = (invoking: string, invoked: string) => ({
  "openai/toolInvocation/invoking": invoking,
  "openai/toolInvocation/invoked": invoked,
});

export function registerTodoTools(server: McpServer, forRequest: ForRequest): void {
  server.registerTool(
    "add_todo",
    {
      title: "Add Sarthi to-dos",
      description:
        "Add to-dos to the user's Sarthi day. Only titles the user explicitly stated — never invent or expand tasks. Duplicates of today's open to-dos are skipped. No XP.",
      inputSchema: {
        titles: z
          .array(z.string().trim().min(1).max(MAX_TODO_TITLE))
          .min(1)
          .max(MAX_TODOS_PER_CALL)
          .describe("The to-do titles exactly as the user said them (max 10)."),
      },
      outputSchema: sarthiStateShape,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: INVOKING("Adding…", "Added"),
    },
    async ({ titles }, extra) => forRequest(extra._meta, "add_todo", (ctx) => addTodoTool(ctx, { titles })),
  );

  server.registerTool(
    "complete_todo",
    {
      title: "Complete a Sarthi to-do",
      description:
        "Mark one of TODAY's open Sarthi to-dos done when the user says they finished it. Pass `todoId` (from `todos`) or the user's words as `title`. Never creates a to-do.",
      inputSchema: {
        todoId: z.string().max(64).optional().describe("The to-do id from `todos`, if known."),
        title: z.string().max(MAX_TODO_TITLE).optional().describe("What the user said they finished."),
      },
      outputSchema: sarthiStateShape,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: INVOKING("Checking off…", "Done"),
    },
    async ({ todoId, title }, extra) =>
      forRequest(extra._meta, "complete_todo", (ctx) => completeTodoTool(ctx, { todoId, title })),
  );
}
