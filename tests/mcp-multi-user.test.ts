/**
 * tests/mcp-multi-user.test.ts — MULTI_USER spaces for ChatGPT accounts. Keyless.
 * (a) two subjects → isolated data · (b) cross-owner confirm refused · (c) a call with no
 * subject never reads/writes another space · (d) setup_space is idempotent.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createCommitService } from "../core/capture";
import { createRepositoryFactory } from "../data/repository";
import {
  CARD_TOKENS_META_KEY,
  confirmEntryRouted,
  deriveCardKey,
  ensureProvisioned,
  getToday,
  logEntries,
  NO_SUBJECT_MESSAGE,
  noSubjectResult,
  setupSpace,
  userKeyForSubject,
  type Card,
  type ToolContext,
} from "../mcp/tools";
import { createLlmGateway } from "../providers";
import { createMemoryDb } from "./helpers/memory-db";

const cardKey = deriveCardKey("test-secret");
const base = { cardKey, requireCardToken: true, log: () => undefined };

async function world() {
  const { db } = await createMemoryDb();
  const factory = createRepositoryFactory(db);
  const contexts = new Map<string, ToolContext>();
  async function forSubject(subject: string): Promise<ToolContext> {
    const { ownerKey, userId } = userKeyForSubject(subject);
    let ctx = contexts.get(userId);
    if (!ctx) {
      const repos = factory.forUser({ userId, email: null, mode: "local" });
      ctx = {
        repos,
        service: createCommitService({ repos, llm: createLlmGateway("fake") }),
        userId,
        ownerKey,
        log: () => undefined,
        logError: () => undefined,
        cardKey,
        requireCardToken: true,
        timezoneOverride: "Asia/Kolkata",
        fallbackTimezone: "Asia/Kolkata",
      };
      await ensureProvisioned(repos, userId, "Asia/Kolkata");
      contexts.set(userId, ctx);
    }
    return ctx;
  }
  const scopeFor = async (ownerKey: string) => contexts.get(`cg_${ownerKey}`) ?? null;
  return { forSubject, scopeFor };
}

const MEAL = { kind: "meal" as const, estimated: true, confidence: 70, kcal: 420, label: "2 rotis, dal" };
const SPEND = { kind: "transaction" as const, estimated: false, confidence: 95, amountRupees: 340, category: "Food & dining" };

test("first sight provisions basics only, idempotently", async () => {
  const { forSubject } = await world();
  const a = await forSubject("subject-A");
  assert.equal(a.userId.startsWith("cg_"), true);
  assert.equal(a.userId.length, 3 + 24);
  assert.deepEqual((await a.repos.money.categories.list({})).map((c) => c.name).sort(), ["Food & dining", "Transport"]);
  assert.equal((await a.repos.habits.habits.list({})).length, 0);
  assert.equal((await a.repos.skills.skills.list({})).length, 0);
  assert.equal((await a.repos.plans.progress.list({})).length, 5);
  assert.equal(await ensureProvisioned(a.repos, a.userId, "Asia/Kolkata"), false);
  assert.equal((await a.repos.money.categories.list({})).length, 2);
});

test("(a) two subjects get isolated spaces", async () => {
  const { forSubject } = await world();
  const a = await forSubject("subject-A");
  const b = await forSubject("subject-B");
  const logged = await logEntries(a, { text: "Spent 340 on lunch", entries: [SPEND] });
  assert.equal(logged.structuredContent.filed.length, 1);
  assert.equal((await getToday(a)).structuredContent.today.money.spentPaise, 34000);
  assert.equal((await getToday(b)).structuredContent.today.money.spentPaise, 0);
  assert.equal((await b.repos.money.transactions.list({})).length, 0);
});

test("(b) a card confirmed from another account's request is refused; its owner can confirm", async () => {
  const { forSubject, scopeFor } = await world();
  const a = await forSubject("subject-A");
  const b = await forSubject("subject-B");
  const logged = await logEntries(a, { text: "had 2 rotis and dal", entries: [MEAL] });
  const card = logged.structuredContent.pending[0] as Card;
  const token = (logged._meta?.[CARD_TOKENS_META_KEY] as Record<string, string>)[card.cardId];
  assert.ok(token.startsWith(`${a.ownerKey}.`));

  const crossed = await confirmEntryRouted(b, scopeFor, { proposal: card.proposal, cardToken: token }, base);
  assert.equal(crossed.isError, true);
  assert.equal(crossed.structuredContent.message, "This card belongs to another Sarthi space.");
  assert.equal((await a.repos.health.meals.list({})).length, 0);
  assert.equal((await b.repos.health.meals.list({})).length, 0);

  const own = await confirmEntryRouted(a, scopeFor, { proposal: card.proposal, cardToken: token }, base);
  assert.equal(own.isError, undefined);
  assert.equal((await a.repos.health.meals.list({})).length, 1);
});

test("(c) no subject: no data leaks; a signed card still files only into its owner's space", async () => {
  const { forSubject, scopeFor } = await world();
  const a = await forSubject("subject-A");
  const b = await forSubject("subject-B");
  await logEntries(a, { text: "Spent 340 on lunch", entries: [SPEND] });

  const anon = noSubjectResult();
  assert.equal(anon.structuredContent.message, NO_SUBJECT_MESSAGE);
  assert.equal(anon.structuredContent.today.money.spentPaise, 0);
  assert.equal(anon.structuredContent.space, undefined);

  const unsigned = await confirmEntryRouted(null, scopeFor, { proposal: { kind: "meal" } }, base);
  assert.equal(unsigned.isError, true);
  assert.equal((await a.repos.health.meals.list({})).length + (await b.repos.health.meals.list({})).length, 0);

  const logged = await logEntries(a, { text: "had 2 rotis and dal", entries: [MEAL] });
  const card = logged.structuredContent.pending[0] as Card;
  const token = (logged._meta?.[CARD_TOKENS_META_KEY] as Record<string, string>)[card.cardId];
  const panel = await confirmEntryRouted(null, scopeFor, { proposal: card.proposal, cardToken: token }, base);
  assert.equal(panel.isError, undefined);
  assert.equal((await a.repos.health.meals.list({})).length, 1);
  assert.equal((await b.repos.health.meals.list({})).length, 0);
});

test("(d) setup_space creates only what was asked, dedups, and is idempotent", async () => {
  const { forSubject } = await world();
  const a = await forSubject("subject-A");
  const first = await setupSpace(a, { habits: ["Meditate", " meditate ", "Read"], skills: ["Guitar"], categories: ["Groceries", "food & dining"] });
  const space = first.structuredContent.space!;
  assert.deepEqual([...space.habits].sort(), ["Meditate", "Read"]);
  assert.deepEqual(space.skills, ["Guitar"]);
  assert.deepEqual([...space.categories].sort(), ["Food & dining", "Groceries", "Transport"]);
  assert.equal((await a.repos.habits.habits.list({})).length, 2);
  assert.equal((await a.repos.money.categories.list({})).length, 3);
  assert.match(first.structuredContent.message, /Added to the user's Sarthi space/);

  const again = await setupSpace(a, { habits: ["MEDITATE", "Read"], skills: ["guitar"], categories: ["Groceries"] });
  assert.match(again.structuredContent.message, /Nothing new to add/);
  assert.equal((await a.repos.habits.habits.list({})).length, 2);
  assert.equal((await a.repos.skills.skills.list({})).length, 1);
  assert.equal((await a.repos.money.categories.list({})).length, 3);

  const habit = await logEntries(a, {
    text: "meditated",
    entries: [{ kind: "habitLog", estimated: false, confidence: 95, habitName: "Meditate" }],
  });
  assert.equal(habit.structuredContent.filed.length, 1);
});
