/**
 * tests/mcp-habit-conflict.test.ts — a second habit log for the same habit + day (active, or
 * soft-deleted by an earlier undo) must never reach the unique index. The MCP layer answers
 * honestly (non-error, nothing written) and lets the rest of the batch proceed. Keyless.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createCommitService } from "../core/capture";
import { createRepositoryFactory } from "../data/repository";
import {
  CARD_TOKENS_META_KEY,
  confirmEntry,
  deriveCardKey,
  logEntries,
  undoLast,
  type Card,
  type ModelEntry,
  type ToolContext,
} from "../mcp/tools";
import { createLlmGateway } from "../providers";
import { createMemoryDb } from "./helpers/memory-db";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const MEDITATE: ModelEntry = { kind: "habitLog", estimated: false, confidence: 95, habitName: "Meditate" };

async function setup() {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const service = createCommitService({ repos, llm: createLlmGateway("fake") });
  await repos.habits.habits.create({
    name: "Meditate",
    cadence: "daily",
    difficulty: "easy",
    targetValue: null,
    targetUnit: null,
    isArchived: false,
  });
  const ctx: ToolContext = {
    repos,
    service,
    userId: "local-dev",
    log: () => undefined,
    logError: () => undefined,
    cardKey: deriveCardKey("test-secret"),
    requireCardToken: true,
  };
  const habitLogs = async () => (await repos.habits.logs.list({})).length;
  return { ctx, repos, habitLogs };
}

test("an already-done habit is a friendly no-op; the rest of the batch still files", async () => {
  const { ctx, repos, habitLogs } = await setup();
  const first = await logEntries(ctx, { text: "did my meditation", entries: [MEDITATE] });
  assert.equal(first.structuredContent.filed.length, 1);
  assert.equal(await habitLogs(), 1);

  const again = await logEntries(ctx, { text: "did my meditation today", entries: [MEDITATE] });
  assert.equal(again.isError, undefined);
  assert.deepEqual(again.structuredContent.filed, []);
  assert.match(again.structuredContent.message, /Meditate is already marked done today — nothing to change\./);
  assert.equal(await habitLogs(), 1);

  const batch = await logEntries(ctx, {
    text: "did my meditation and drank 500 ml",
    entries: [MEDITATE, { kind: "water", estimated: false, confidence: 95, millilitres: 500 }],
  });
  assert.equal(batch.isError, undefined);
  assert.deepEqual(batch.structuredContent.filed.map((f) => f.kind), ["water"]);
  assert.match(batch.structuredContent.message, /Meditate is already marked done today/);
  assert.equal((await repos.health.waterLogs.list({})).length, 1);
  assert.equal(await habitLogs(), 1);
});

test("a habit undone earlier today is answered honestly instead of crashing", async () => {
  const { ctx, habitLogs } = await setup();
  await logEntries(ctx, { text: "did my meditation", entries: [MEDITATE] });
  const undone = await undoLast(ctx);
  assert.match(undone.structuredContent.message, /^Undid/);
  assert.equal(await habitLogs(), 0);

  const relog = await logEntries(ctx, { text: "did my meditation", entries: [MEDITATE] });
  assert.equal(relog.isError, undefined);
  assert.deepEqual(relog.structuredContent.filed, []);
  assert.match(relog.structuredContent.message, /Meditate was undone earlier today — Sarthi can't re-log it until tomorrow \(known issue\)\./);
});

test("confirming a habit card for an already-done habit clears the card without writing", async () => {
  const { ctx, habitLogs } = await setup();
  const carded = await logEntries(ctx, {
    text: "meditated I think",
    entries: [{ ...MEDITATE, estimated: true, confidence: 60 }],
  });
  const card = carded.structuredContent.pending[0] as Card;
  const token = (carded._meta?.[CARD_TOKENS_META_KEY] as Record<string, string>)[card.cardId];
  await logEntries(ctx, { text: "did my meditation", entries: [MEDITATE] });
  assert.equal(await habitLogs(), 1);

  const res = await confirmEntry(ctx, { proposal: card.proposal, cardToken: token });
  assert.equal(res.isError, undefined);
  assert.equal(res.structuredContent.confirmedCardId, card.cardId);
  assert.deepEqual(res.structuredContent.filed, []);
  assert.match(res.structuredContent.message, /already marked done today/);
  assert.equal(await habitLogs(), 1);
});
