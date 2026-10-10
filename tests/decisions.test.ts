/**
 * tests/decisions.test.ts — Luna (Decisions API) port: fake determinism, the openai adapter's
 * cap / cache / timeout / refusal fallbacks (stub fetch, no network), and the MCP rules:
 * demote-only predicates, choice threshold, one batched call per message. Keyless.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createCommitService, type Proposal } from "../core/capture";
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from "../core/contracts";
import { createRepositoryFactory } from "../data/repository";
import { lunaCheck } from "../mcp/decisions";
import { deriveCardKey, logEntries, type ToolContext } from "../mcp/tools";
import { createLlmGateway } from "../providers";
import { createFakeDecisionProvider, createOpenAiDecisionProvider, fakeAnswers } from "../providers/decisions";
import { createMemoryDb } from "./helpers/memory-db";

const SENTENCE = "Spent 450 on a team lunch, had a paneer wrap and lassi, 45 min of system design";
const PRED = (name: string, value: string): DecisionQuestion => ({ type: "predicate", name, instructions: `stated ${value}`, value });
const CHOICE = (name: string, candidate: string, values: string[]): DecisionQuestion => ({
  type: "choice",
  name,
  instructions: "which?",
  choices: [...values, "none"].map((value) => ({ value, description: value })),
  candidate,
});

/** A stub provider that answers every predicate with `p` and every choice with `choice@conf`; counts calls. */
function stub(p: number, choice = "none", conf = 0): DecisionProvider & { calls: number; seen: DecisionQuestion[][] } {
  const self = {
    name: "openai" as const,
    calls: 0,
    seen: [] as DecisionQuestion[][],
    async decide(_input: string, questions: DecisionQuestion[]): Promise<DecisionAnswer[]> {
      self.calls += 1;
      self.seen.push(questions);
      return questions.map((q) =>
        q.type === "predicate"
          ? { type: "predicate", name: q.name, probability: p, source: "live" }
          : { type: "choice", name: q.name, choice, confidence: conf, source: "live" },
      );
    },
  };
  return self;
}

function okResponse(answers: unknown[]): Response {
  return new Response(JSON.stringify({ answers, model: "gpt-6-luna" }), { status: 200, headers: { "content-type": "application/json" } });
}

test("fake: predicates 0.99 when literal else 0.05; choices exact case-insensitive else none@0", () => {
  const answers = fakeAnswers(SENTENCE, [PRED("a", "450"), PRED("b", "420"), CHOICE("c", "SYSTEM DESIGN", ["System design", "DSA"]), CHOICE("d", "sys design", ["System design"])]);
  assert.deepEqual(answers, [
    { type: "predicate", name: "a", probability: 0.99 },
    { type: "predicate", name: "b", probability: 0.05 },
    { type: "choice", name: "c", choice: "System design", confidence: 1 },
    { type: "choice", name: "d", choice: "none", confidence: 0 },
  ]);
  assert.equal(fakeAnswers("weighed 72.50 kg", [PRED("w", "72.5")])[0].type === "predicate" && (fakeAnswers("weighed 72.50 kg", [PRED("w", "72.5")])[0] as { probability: number }).probability, 0.99);
});

test("openai adapter: hard cap, cache, and hints never sent upstream", async () => {
  let fetches = 0;
  const bodies: unknown[] = [];
  const provider = createOpenAiDecisionProvider({
    apiKey: "test",
    maxCalls: 1,
    fetch: (async (_url: string, init: RequestInit) => {
      fetches += 1;
      bodies.push(JSON.parse(String(init.body)));
      return okResponse([{ type: "predicate", name: "a", probability: 0.42 }]);
    }) as unknown as typeof fetch,
  });
  const first = await provider.decide(SENTENCE, [PRED("a", "450")]);
  assert.deepEqual(first, [{ type: "predicate", name: "a", probability: 0.42, source: "live" }]);
  const again = await provider.decide(SENTENCE, [PRED("a", "450")]);
  assert.equal(again[0].source, "cache");
  assert.equal(fetches, 1);
  const body = bodies[0] as { model: string; questions: Record<string, unknown>[] };
  assert.equal(body.model, "gpt-6-luna");
  assert.equal("value" in body.questions[0], false);
  // A different question past the cap → deterministic fallback, no fetch.
  const capped = await provider.decide(SENTENCE, [PRED("b", "999")]);
  assert.deepEqual(capped, [{ type: "predicate", name: "b", probability: 0.05, source: "fallback" }]);
  assert.equal(fetches, 1);
  assert.deepEqual(provider.stats(), { calls: 1, cached: 1, fallbacks: 1 });
});

test("openai adapter: timeout, http error, refusal, and no key all fall back (fail closed)", async () => {
  const hang = createOpenAiDecisionProvider({
    apiKey: "test",
    timeoutMs: 20,
    fetch: ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })) as unknown as typeof fetch,
  });
  const started = Date.now();
  const timedOut = await hang.decide(SENTENCE, [PRED("a", "450")]);
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(timedOut, [{ type: "predicate", name: "a", probability: 0.99, source: "fallback" }]);

  const http = createOpenAiDecisionProvider({ apiKey: "t", fetch: (async () => new Response("no", { status: 429 })) as unknown as typeof fetch });
  assert.equal((await http.decide(SENTENCE, [PRED("a", "450")]))[0].source, "fallback");

  const refusal = createOpenAiDecisionProvider({
    apiKey: "t",
    fetch: (async () => okResponse([{ type: "refusal", name: "c" }])) as unknown as typeof fetch,
  });
  assert.deepEqual(await refusal.decide(SENTENCE, [CHOICE("c", "sys design", ["System design"])]), [
    { type: "choice", name: "c", choice: "none", confidence: 0, source: "fallback" },
  ]);

  let fetched = false;
  const noKey = createOpenAiDecisionProvider({ apiKey: null, fetch: (async () => { fetched = true; return okResponse([]); }) as unknown as typeof fetch });
  assert.equal((await noKey.decide(SENTENCE, [PRED("a", "450")]))[0].source, "fallback");
  assert.equal(fetched, false);
});

function proposal(kind: "transaction" | "skillSession", over: Partial<Proposal> = {}, payload: Record<string, unknown> = {}): Proposal {
  const base = {
    proposalId: crypto.randomUUID(),
    intent: "create" as const,
    occurredAt: "2026-10-10T07:00:00.000Z",
    localDate: "2026-10-10",
    timezone: "Asia/Kolkata",
    estimated: false,
    confidenceBps: 9500,
    why: { basis: "test", assumptions: [] },
    evidenceRefs: [],
  };
  return (kind === "transaction"
    ? { ...base, domain: "money", kind, payload: { direction: "expense", amountPaise: 45000, categoryName: "Food & dining", merchant: null, note: "Team lunch", ...payload }, ...over }
    : { ...base, domain: "skills", kind, payload: { skillName: "System design", minutes: 45, note: null, ...payload }, ...over }) as Proposal;
}
const NAMES = { categories: ["Food & dining", "Transport"], habits: [], skills: ["System design", "DSA"] };

test("lunaCheck: low probability demotes with the Luna reason; never promotes an estimate", async () => {
  const low = await lunaCheck(stub(0.3), SENTENCE, [proposal("transaction")], NAMES);
  assert.equal(low.proposals[0].estimated, true);
  assert.ok(low.proposals[0].confidenceBps <= 8999);
  assert.deepEqual(low.reasons[0], ["Luna: 30% likely you stated ₹450"]);

  const high = await lunaCheck(stub(0.95), SENTENCE, [proposal("transaction")], NAMES);
  assert.equal(high.proposals[0].estimated, false);
  assert.equal(high.proposals[0].confidenceBps, 9500);

  const provider = stub(0.99);
  const est = await lunaCheck(provider, SENTENCE, [proposal("transaction", { estimated: true, confidenceBps: 7000 })], NAMES);
  assert.equal(est.proposals[0].estimated, true);
  assert.equal(est.proposals[0].confidenceBps, 7000);
  assert.equal(provider.calls, 0, "an estimate is never sent for a second opinion");
});

test("lunaCheck: a name pick needs ≥0.85 and a real existing name, and still becomes a card", async () => {
  const sys = proposal("skillSession", {}, { skillName: "sys design" });
  const below = await lunaCheck(stub(0.99, "System design", 0.84), SENTENCE, [sys], NAMES);
  assert.equal((below.proposals[0].payload as { skillName: string }).skillName, "sys design");
  const none = await lunaCheck(stub(0.99, "none", 0.99), SENTENCE, [sys], NAMES);
  assert.equal((none.proposals[0].payload as { skillName: string }).skillName, "sys design");
  const hit = await lunaCheck(stub(0.99, "System design", 0.92), SENTENCE, [sys], NAMES);
  assert.equal((hit.proposals[0].payload as { skillName: string }).skillName, "System design");
  assert.ok(hit.proposals[0].confidenceBps <= 8999, "a Luna-matched name routes to a card");
  assert.equal(hit.proposals[0].estimated, false);
  assert.match(hit.reasons[0][0], /^Luna matched "sys design" to your skill "System design" \(92%\)/);
});

test("log_entries: one batched Luna call per message; low probability → card; decisions summary", async () => {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser({ userId: "local-dev", email: null, mode: "local" });
  await repos.money.categories.create({ name: "Food & dining", kind: "expense", colorKey: null, isSystem: false });
  await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  const provider = stub(0.5);
  const ctx: ToolContext = {
    repos,
    service: createCommitService({ repos, llm: createLlmGateway("fake") }),
    userId: "local-dev",
    log: () => undefined,
    logError: () => undefined,
    cardKey: deriveCardKey("t"),
    requireCardToken: true,
    decisions: provider,
  };
  const res = await logEntries(ctx, {
    text: SENTENCE,
    entries: [
      { kind: "transaction", estimated: false, confidence: 95, amountRupees: 450, category: "Food & dining", label: "Team lunch" },
      { kind: "meal", estimated: true, confidence: 70, kcal: 650, label: "paneer wrap, lassi" },
      { kind: "skillSession", estimated: false, confidence: 95, skillName: "System design", minutes: 45 },
    ],
  });
  assert.equal(provider.calls, 1);
  assert.equal(provider.seen[0].length, 2, "only the two literal values are checked");
  const s = res.structuredContent;
  assert.deepEqual(s.filed, []);
  assert.equal(s.pending.length, 3);
  assert.ok(s.pending.some((c) => c.reasons.includes("Luna: 50% likely you stated ₹450")));
  assert.deepEqual(s.decisions, { provider: "openai", calls: 1, cached: 0, checked: 2 });
  assert.match(s.message, /Luna checked 2 values\./);
  assert.equal((await repos.money.transactions.list({})).length, 0, "nothing Luna doubted was written");

  // Keyless default (fake) never demotes a literal value.
  const fakeCtx = { ...ctx, decisions: createFakeDecisionProvider() };
  const ok = await logEntries(fakeCtx, {
    text: "Spent 450 on a team lunch today",
    entries: [{ kind: "transaction", estimated: false, confidence: 95, amountRupees: 450, category: "Food & dining", label: "Team lunch" }],
  });
  assert.equal(ok.structuredContent.filed.length, 1);
  assert.equal(ok.structuredContent.decisions?.calls, 0);
});
