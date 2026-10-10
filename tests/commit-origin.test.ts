/**
 * tests/commit-origin.test.ts — commit provenance (`origin: "chatgpt"`) + grounded capture
 * coach line. Keyless (fake LLM, network blocked). A ChatGPT-plugin commit ticks the
 * matching plan item with `completionSource:"chatgpt"` (Today badge "via ChatGPT"), entry
 * rows keep `source:"capture"`, undo restores the item, and the coach note's evidence is the
 * committed rows (not an ungrounded count).
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createCommitService, type ResolvedProposal } from "../core/capture";
import { buildTodayView } from "../core/domains/today";
import { createRepositoryFactory } from "../data/repository";
import { createLlmGateway } from "../providers";
import { createMemoryDb } from "./helpers/memory-db";

const LOCAL = { userId: "local-dev", email: null, mode: "local" as const };
const NOW = "2026-07-17T05:20:00.000Z";
const DAY = "2026-07-17";

let savedFetch: typeof globalThis.fetch;
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("commit-origin test must not hit the network");
  }) as typeof globalThis.fetch;
});
after(() => {
  globalThis.fetch = savedFetch;
});

function water(proposalId: string): ResolvedProposal {
  return {
    proposalId,
    kind: "water",
    domain: "health",
    intent: "create",
    occurredAt: NOW,
    localDate: DAY,
    timezone: "UTC",
    estimated: false,
    confidenceBps: 9600,
    why: { basis: "explicit 500 ml", assumptions: [] },
    evidenceRefs: [],
    status: "auto",
    payload: { millilitres: 500 },
  };
}

async function setup(origin?: "chatgpt") {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(LOCAL);
  const arc = await repos.plans.arcs.create({
    domain: "overall", mode: "build", title: "First 30 days", startDate: DAY, endDate: "2026-08-15", dayNumber: 1, status: "active",
  });
  const item = await repos.plans.items.create({
    arcId: arc.id, domain: "health", kind: "task", title: "Drink water", dueAt: null, localDate: DAY, targetValue: null, targetUnit: null,
    status: "active", completionSource: null, ruleJson: null, linkedHabitId: null, linkedSkillId: null,
  });
  const service = createCommitService({ repos, llm: createLlmGateway("fake"), now: () => NOW, origin });
  return { repos, service, item };
}

test("service-level origin chatgpt → plan tick says via ChatGPT; entry source stays capture; undo restores", async () => {
  const { repos, service, item } = await setup("chatgpt");
  const result = await service.commit({ idempotencyKey: "k-gpt", kind: "capture", proposals: [water("p1")] });
  assert.equal(result.status, "committed");

  const ticked = await repos.plans.items.byId(item.id);
  assert.equal(ticked?.status, "done");
  assert.equal(ticked?.completionSource, "chatgpt");
  const [log] = await repos.health.waterLogs.list({});
  assert.equal(log.source, "capture");
  const envelope = await repos.commits.commits.byId(result.commitId);
  assert.match(envelope!.summary, /via ChatGPT$/);

  const view = buildTodayView({ localDate: DAY, items: [ticked!], progress: [], arcs: [], coachNote: null, arcHistoryItems: [] });
  const viewItem = [...view.completed].find((i) => i.id === item.id);
  assert.equal(viewItem?.via, "chatgpt");

  // Grounded coach note: evidence is the committed rows + the ticked plan item.
  assert.ok(result.coachNoteId);
  const note = (await repos.coach.notes.list({ scope: "capture" }))[0];
  const labels = note.evidenceJson.items.map((i) => i.label);
  assert.ok(labels.includes("drank 500 ml water"), labels.join(" | "));
  assert.ok(labels.includes("plan item done: Drink water"), labels.join(" | "));

  await service.undoLatest({ commitId: result.commitId, now: NOW });
  const restored = await repos.plans.items.byId(item.id);
  assert.equal(restored?.status, "active");
  assert.equal(restored?.completionSource, null);
});

test("default (app) origin keeps via capture; per-call origin overrides the service default", async () => {
  const app = await setup();
  await app.service.commit({ idempotencyKey: "k-app", kind: "capture", proposals: [water("p2")] });
  assert.equal((await app.repos.plans.items.byId(app.item.id))?.completionSource, "capture");

  const perCall = await setup();
  await perCall.service.commit({ idempotencyKey: "k-call", kind: "tap", proposals: [water("p3")], origin: "chatgpt" });
  assert.equal((await perCall.repos.plans.items.byId(perCall.item.id))?.completionSource, "chatgpt");
});
