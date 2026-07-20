import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import {
  RUNTIME_LLM_PROVIDER_HEADER,
  RuntimeOverrideError,
  isDeveloperControlAllowed,
  resolveRequestLlmProvider,
} from "../app/lib/runtimeOverride";
import {
  createLlmGateway,
  createVisionProvider,
  createVoiceProvider,
} from "../providers";
import {
  FakeLlmGateway,
  FakeVisionProvider,
  FakeVoiceProvider,
} from "../providers/fake";
import {
  LLM_MODEL_MATRIX,
  ProviderConfigurationError,
  resolveLlmModelId,
  VERIFIED_LLM_MODEL_IDS,
} from "../providers/llm";
import { AiSdkLlmGateway } from "../providers/llm/ai-sdk";
import { AiSdkVisionProvider } from "../providers/vision/ai-sdk";

const canonicalSchema = z.object({
  fixtureId: z.literal("canonical-cross-domain"),
  fixtureVersion: z.literal("sarthi-fixtures-v1"),
  rawText: z.string(),
  proposals: z.array(z.object({
    kind: z.string(),
    estimated: z.boolean(),
    confidenceBps: z.number().int(),
    payload: z.unknown(),
  })),
});

const mealSchema = z.object({
  fixtureId: z.literal("estimated-meal-photo"),
  fixtureVersion: z.literal("sarthi-fixtures-v1"),
  estimated: z.literal(true),
  meal: z.object({ kcal: z.number().int() }),
});

const receiptSchema = z.object({
  fixtureId: z.literal("receipt-batch"),
  fixtureVersion: z.literal("sarthi-fixtures-v1"),
  requiresExplicitAcceptance: z.literal(true),
  transactions: z.array(z.object({ amountPaise: z.number().int() })),
});

function isExplicitAutoWriteValue(proposal: { estimated: boolean; confidenceBps: number }): boolean {
  return proposal.estimated === false && proposal.confidenceBps >= 9000;
}

test("the immutable matrix exposes only the signed model IDs", () => {
  assert.deepEqual(LLM_MODEL_MATRIX.google, {
    deep: "gemini-2.5-flash",
    balanced: "gemini-2.5-flash",
    fast: "gemini-2.5-flash-lite",
  });
  assert.deepEqual(LLM_MODEL_MATRIX.openai, {
    deep: "gpt-5.6-sol",
    balanced: "gpt-5.6-terra",
    fast: "gpt-5.6-luna",
  });
  assert.deepEqual(LLM_MODEL_MATRIX.fake, {
    deep: "fake-deep-v1",
    balanced: "fake-balanced-v1",
    fast: "fake-fast-v1",
  });
  assert.deepEqual(LLM_MODEL_MATRIX.anthropic, { deep: null, balanced: null, fast: null });
  assert.deepEqual(VERIFIED_LLM_MODEL_IDS.openai, ["gpt-5.6-sol", "gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna"]);
  assert.equal(resolveLlmModelId("openai", "deep"), "gpt-5.6-sol");
  assert.throws(() => resolveLlmModelId("anthropic", "fast"), ProviderConfigurationError);
  assert.ok(Object.isFrozen(LLM_MODEL_MATRIX));
  assert.ok(Object.isFrozen(LLM_MODEL_MATRIX.google));
});

test("provider factories select fake and fail clearly for disabled or deferred providers", () => {
  assert.ok(createLlmGateway("fake") instanceof FakeLlmGateway);
  assert.ok(createVoiceProvider("fake") instanceof FakeVoiceProvider);
  assert.ok(createVisionProvider("fake") instanceof FakeVisionProvider);
  assert.throws(() => createLlmGateway("anthropic"), /wired but disabled/);
  assert.throws(() => createVoiceProvider("sarvam"), /not implemented in SAR-002/);
});

test("live LLM factories construct their adapters without a network request", () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("factory construction must not call fetch");
  };

  try {
    assert.ok(createLlmGateway("google") instanceof AiSdkLlmGateway);
    assert.ok(createLlmGateway("openai") instanceof AiSdkLlmGateway);
    // BYOK: the live vision adapter constructs the same way (with or without a per-request key).
    assert.ok(createVisionProvider("google") instanceof AiSdkVisionProvider);
    assert.ok(createVisionProvider("openai") instanceof AiSdkVisionProvider);
    assert.ok(createVisionProvider("google", { apiKey: "test-key" }) instanceof AiSdkVisionProvider);
    assert.ok(createLlmGateway("openai", { apiKey: "test-key" }) instanceof AiSdkLlmGateway);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("public production ignores client provider headers while development and judge mode allow the signed matrix", () => {
  assert.equal(
    resolveRequestLlmProvider(new Headers({ [RUNTIME_LLM_PROVIDER_HEADER]: "fake" }), { judgeMode: false }, "production"),
    null,
  );
  assert.equal(isDeveloperControlAllowed({ judgeMode: false }, "production"), false);
  assert.equal(
    resolveRequestLlmProvider(new Headers({ [RUNTIME_LLM_PROVIDER_HEADER]: "fake" }), { judgeMode: false }, "development"),
    "fake",
  );
  assert.equal(
    resolveRequestLlmProvider(new Headers({ [RUNTIME_LLM_PROVIDER_HEADER]: "openai" }), { judgeMode: true }, "production"),
    "openai",
  );
});

test("runtime override ignores voice headers, rejects Anthropic, and never shares a selection across requests", () => {
  const config = { judgeMode: false };
  assert.throws(
    () => resolveRequestLlmProvider(new Headers({ [RUNTIME_LLM_PROVIDER_HEADER]: "anthropic" }), config, "development"),
    RuntimeOverrideError,
  );
  assert.equal(
    resolveRequestLlmProvider(new Headers({ "x-sarthi-voice-provider": "sarvam" }), config, "development"),
    null,
  );
  assert.equal(
    resolveRequestLlmProvider(new Headers({ [RUNTIME_LLM_PROVIDER_HEADER]: "fake" }), config, "development"),
    "fake",
  );
  assert.equal(resolveRequestLlmProvider(new Headers(), config, "development"), null);
});

test("fake adapters are keyless, deterministic, and never invoke fetch", async () => {
  const savedFetch = globalThis.fetch;
  const savedGoogleKey = process.env.GOOGLE_API_KEY;
  const savedOpenAiKey = process.env.OPENAI_API_KEY;
  const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  globalThis.fetch = async () => {
    throw new Error("fake stack must not call fetch");
  };

  try {
    const llm = createLlmGateway("fake");
    const request = {
      tier: "deep" as const,
      schema: canonicalSchema,
      system: "test",
      prompt: "test",
      telemetry: { operation: "capture-parse" as const },
    };
    const first = await llm.generateObject(request);
    const second = await llm.generateObject(request);
    assert.deepEqual(first, second);
    assert.equal(first.modelId, "fake-deep-v1");
    assert.deepEqual(first.usage, { inputTokens: 42, outputTokens: 18 });
    assert.equal(first.object.proposals[0]?.estimated, false);
    assert.equal(first.object.proposals[1]?.estimated, true);
    const waterProposal = first.object.proposals.find((proposal) => proposal.kind === "water");
    assert.ok(waterProposal);
    assert.equal(waterProposal.estimated, true);
    assert.ok(waterProposal.confidenceBps < 9000);
    assert.equal((waterProposal.payload as { millilitres: number | null }).millilitres, null);
    assert.equal(isExplicitAutoWriteValue(waterProposal), false, "an unknown bottle volume cannot auto-write");

    const text = await llm.generateText({
      tier: "fast",
      system: "test",
      prompt: "test",
      telemetry: { operation: "capture-line" },
    });
    assert.equal(text.modelId, "fake-fast-v1");
    assert.match(text.text, /Confirm the meal estimate/);

    const voice = await createVoiceProvider("fake").transcribe({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/webm",
      durationMs: 500,
    });
    assert.deepEqual(voice, {
      text: "Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design, woke at 5:10",
      confidenceBps: 9800,
      languageCode: "en-IN",
    });

    // SAR-011 override #1: meal vs receipt is chosen by the toggle-derived PROMPT the
    // FakeVisionProvider keys on ("receipt" ⇒ receipt fixture), never the filename. The
    // filenames below are deliberately CROSSED (meal bytes named receipt.jpg and vice
    // versa) to document that the old filename cue is dead — the prompt alone decides.
    const vision = createVisionProvider("fake");
    const meal = await vision.analyze({
      images: [{ bytes: new Uint8Array([1]), mimeType: "image/jpeg", filename: "receipt.jpg" }],
      schema: mealSchema,
      prompt: "Analyze this meal photo and return the estimated nutrition as a typed meal entry.",
      tier: "balanced",
    });
    const receipt = await vision.analyze({
      images: [{ bytes: new Uint8Array([2]), mimeType: "image/jpeg", filename: "meal.jpg" }],
      schema: receiptSchema,
      prompt: "Read this receipt photo and return the printed transactions as typed money entries.",
      tier: "deep",
    });
    assert.equal(meal.provider, "fake");
    assert.equal(meal.modelId, "fake-vision-balanced-v1");
    assert.deepEqual(meal.usage, { inputTokens: 31, outputTokens: 16 });
    assert.equal(meal.object.estimated, true);
    assert.equal(receipt.object.requiresExplicitAcceptance, true);
    assert.equal(receipt.object.transactions[0]?.amountPaise, 34000);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedGoogleKey === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = savedGoogleKey;
    if (savedOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedOpenAiKey;
    if (savedAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
  }
});

test("fake adapters validate caller-owned schemas", async () => {
  await assert.rejects(
    createLlmGateway("fake").generateObject({
      tier: "deep",
      schema: z.object({ impossible: z.literal(true) }),
      system: "test",
      prompt: "test",
      telemetry: { operation: "capture-parse" },
    }),
    z.ZodError,
  );
  await assert.rejects(
    createVisionProvider("fake").analyze({
      images: [{ bytes: new Uint8Array([1]), mimeType: "image/png" }],
      schema: z.object({ impossible: z.literal(true) }),
      prompt: "meal",
      tier: "balanced",
    }),
    z.ZodError,
  );
});
