/**
 * tests/parse.test.ts — parseDump (SAR-004, rule 1). Keyless, network-free.
 * Happy path returns the canonical draft; any gateway failure is a retryable
 * draft with zero rows (provider-failure).
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import type { LlmGateway } from "../core/contracts";
import { parseDump } from "../core/capture";
import { createLlmGateway } from "../providers";
import { CANONICAL_CROSS_DOMAIN_DUMP } from "../providers/fake/fixtures";

const INPUT = {
  rawText: CANONICAL_CROSS_DOMAIN_DUMP,
  timezone: "Asia/Kolkata",
  capturedAt: "2026-07-17T05:15:00.000Z",
  source: "voice" as const,
};

let savedFetch: typeof globalThis.fetch;
const savedKeys: Record<string, string | undefined> = {};
before(() => {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("parse test must not hit the network");
  }) as typeof globalThis.fetch;
  for (const key of ["GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) {
    savedKeys[key] = process.env[key];
    delete process.env[key];
  }
});
after(() => {
  globalThis.fetch = savedFetch;
  for (const [key, value] of Object.entries(savedKeys)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("parseDump on the fake stack returns the canonical draft (5 proposals)", async () => {
  const result = await parseDump(INPUT, createLlmGateway("fake"));
  assert.ok(result.ok, "fake capture-parse should succeed");
  assert.equal(result.draft.version, 1);
  assert.equal(result.draft.proposals.length, 5);
});

test("parseDump retains proposals but the caller owns capture transport metadata", async () => {
  const result = await parseDump(
    {
      rawText: "edited transcript",
      timezone: "Asia/Kolkata",
      capturedAt: "2026-07-18T10:00:00.000Z",
      source: "voice",
      transcriptConfidenceBps: 8700,
    },
    createLlmGateway("fake"),
  );
  assert.ok(result.ok);
  assert.equal(result.draft.rawText, "edited transcript");
  assert.equal(result.draft.capturedAt, "2026-07-18T10:00:00.000Z");
  assert.equal(result.draft.timezone, "Asia/Kolkata");
  assert.equal(result.draft.source, "voice");
  assert.equal(result.draft.transcriptConfidenceBps, 8700);
  assert.equal(result.draft.proposals.length, 5, "gateway proposals remain intact");
});

test("text parse defaults source and transcript confidence even if the gateway object differs", async () => {
  const result = await parseDump(
    { rawText: "typed capture", timezone: "UTC", capturedAt: "2026-07-18T10:00:00.000Z" },
    createLlmGateway("fake"),
  );
  assert.ok(result.ok);
  assert.equal(result.draft.source, "text");
  assert.equal(result.draft.transcriptConfidenceBps, null);
});

test("a gateway failure yields a retryable draft — zero rows, zero outbox", async () => {
  const throwing: LlmGateway = {
    async generateObject() {
      throw new Error("provider unavailable");
    },
    async generateText() {
      throw new Error("provider unavailable");
    },
  };
  const result = await parseDump(INPUT, throwing);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.retryable, true);
  }
});
