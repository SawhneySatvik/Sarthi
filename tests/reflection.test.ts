import assert from "node:assert/strict";
import test from "node:test";

import { summarizeReflection } from "../core/coach";
import { pickTodayReflection } from "../components/journey/pickTodayReflection";
import type { DailyReflectionRecord } from "../data/schema/contract";
import type { LlmGateway } from "../core/contracts";
import { createRepositoryFactory } from "../data/repository";
import { createLlmGateway } from "../providers";
import { createMemoryDb } from "./helpers/memory-db";

const USER = { userId: "reflection-user", email: null, mode: "local" as const };
const input = { localDate: "2026-07-19", mood: "great" as const, energyLevel: 4, sleepMinutes: 450, journal: "Finished a clear study block." };

async function reposForTest() {
  const { db } = await createMemoryDb();
  return createRepositoryFactory(db).forUser(USER);
}

test("reflection summary uses the keyless fake LLM with only explicit fields and typed facts", async () => {
  const repos = await reposForTest();
  await repos.health.waterLogs.create({ occurredAt: "2026-07-19T09:00:00.000Z", localDate: input.localDate, timezone: "UTC", millilitres: 750, source: "capture", confidenceBps: 10_000, estimated: false });
  const result = await summarizeReflection(repos, createLlmGateway("fake"), input);
  assert.equal(result.provider, "fake");
  assert.equal(result.modelId, "fake-fast-v1");
  assert.equal(result.usedFallback, false);
  assert.match(result.text, /great mood and energy 4\/5/);
  assert.match(result.text, /1 typed facts/);
});

test("pickTodayReflection never pre-fills a past day (data-loss guard)", () => {
  const past = { localDate: "2026-07-18" } as DailyReflectionRecord;
  const todayRecord = { localDate: "2026-07-20" } as DailyReflectionRecord;
  // Returning user on a fresh day with only past reflections → clean slate, never the past record.
  assert.equal(pickTodayReflection([past], "2026-07-20"), null);
  // Today's own record is the only thing that may pre-fill.
  assert.equal(pickTodayReflection([past, todayRecord], "2026-07-20"), todayRecord);
});

test("reflection summary retains a factual deterministic fallback only after provider failure", async () => {
  const repos = await reposForTest();
  const failing: LlmGateway = {
    async generateObject() { throw new Error("not used"); },
    async generateText() { throw new Error("provider unavailable"); },
  };
  const result = await summarizeReflection(repos, failing, { ...input, mood: "rough", sleepMinutes: null, journal: "" });
  assert.deepEqual({ provider: result.provider, modelId: result.modelId, usedFallback: result.usedFallback }, { provider: "deterministic", modelId: "local-fallback", usedFallback: true });
  assert.equal(result.text, "rough mood, energy 4/5. Sleep was not recorded. You saved a quiet check-in.");
});
