/**
 * tests/mcp-card-token.test.ts — "only the user's tap confirms" is server-enforced.
 * Keyless: an isolated SQLite fixture + the fake LLM. A pending card is filed only with
 * the panel-held HMAC token that binds its exact proposal.
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
  type Card,
  type ToolContext,
} from "../mcp/tools";
import { createLlmGateway } from "../providers";
import { createMemoryDb } from "./helpers/memory-db";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const TEXT = "had 2 rotis and dal";

async function setup(requireCardToken = true) {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const service = createCommitService({ repos, llm: createLlmGateway("fake") });
  const lines: string[] = [];
  const ctx: ToolContext = {
    repos,
    service,
    userId: "local-dev",
    log: (line) => lines.push(line),
    logError: () => undefined,
    cardKey: deriveCardKey("test-secret"),
    requireCardToken,
  };
  const logged = await logEntries(ctx, {
    text: TEXT,
    entries: [{ kind: "meal", estimated: true, confidence: 70, kcal: 420, label: "2 rotis, dal" }],
  });
  const card = logged.structuredContent.pending[0] as Card;
  const tokens = logged._meta?.[CARD_TOKENS_META_KEY] as Record<string, string>;
  return { ctx, repos, card, tokens, lines, logged };
}

test("log_entries hands the panel a token per card in result _meta, never in content/structuredContent", async () => {
  const { card, tokens, logged } = await setup();
  assert.equal(logged.structuredContent.pending.length, 1);
  assert.match(tokens[card.cardId], /^local-dev\.[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(logged.structuredContent).includes(tokens[card.cardId]));
  assert.ok(!JSON.stringify(logged.content).includes(tokens[card.cardId]));
});

test("a valid card token files the card", async () => {
  const { ctx, repos, card, tokens } = await setup();
  const res = await confirmEntry(ctx, { proposal: card.proposal, cardToken: tokens[card.cardId] });
  assert.equal(res.isError, undefined);
  assert.equal(res.structuredContent.filed.length, 1);
  assert.equal(res.structuredContent.confirmedCardId, card.cardId);
  assert.equal((await repos.health.meals.list({})).length, 1);
});

test("a tampered proposal with the original token is refused; nothing written", async () => {
  const { ctx, repos, card, tokens, lines } = await setup();
  const tampered = structuredClone(card.proposal) as { payload: { kcal: number } };
  tampered.payload.kcal = 99;
  const res = await confirmEntry(ctx, { proposal: tampered, cardToken: tokens[card.cardId] });
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent.message, "This card can only be confirmed from the Sarthi panel.");
  assert.equal((await repos.health.meals.list({})).length, 0);
  assert.ok(lines.includes("confirm refused: missing/invalid card token"));
});

test("a missing token is refused unless REQUIRE_CARD_TOKEN is off", async () => {
  const strict = await setup();
  const refused = await confirmEntry(strict.ctx, { proposal: strict.card.proposal });
  assert.equal(refused.isError, true);
  assert.equal((await strict.repos.health.meals.list({})).length, 0);

  const lax = await setup(false);
  const filed = await confirmEntry(lax.ctx, { proposal: lax.card.proposal });
  assert.equal(filed.isError, undefined);
  assert.equal((await lax.repos.health.meals.list({})).length, 1);
});
