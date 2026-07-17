/**
 * tests/eval/harness.ts — SAR-007 (D-D). The keyless, deterministic F3-eval driver.
 * Same posture as tests/commit.test.ts: an isolated migrated memory DB + the fake
 * gateway + a fixed clock, seeded with the canonical entities (SAR-006's
 * `seedCanonicalEntities` — "SAR-007 reuses it"). No network, no keys.
 */
import { createCommitService } from "../../core/capture";
import { createRepositoryFactory } from "../../data/repository";
import { seedCanonicalEntities } from "../../data/seed/canonical";
import { createLlmGateway } from "../../providers";
import { createMemoryDb } from "../helpers/memory-db";

export const EVAL_USER = { userId: "local-dev", email: null, mode: "local" as const };
export const EVAL_NOW = "2026-07-18T05:20:00.000Z";
export const EVAL_WITHIN = "2026-07-18T05:22:00.000Z"; // < EVAL_NOW + 5min (undo window)

export async function evalSetup() {
  const { db } = await createMemoryDb();
  const repos = createRepositoryFactory(db).forUser(EVAL_USER);
  await seedCanonicalEntities(repos);
  const llm = createLlmGateway("fake");
  const service = createCommitService({ repos, llm, now: () => EVAL_NOW });
  return { repos, llm, service };
}
