/**
 * tests/onboarding-contract.test.ts — SAR-012 Pass 1. Keyless, network-free.
 * The CORE answer contract (integer enforcement + imperial→metric), the min-1-domain
 * rule, the versioned local draft round-trip, and the voice-fill seam (deterministic
 * canned fills on the fake; failure = zero fields, zero side effects).
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { LlmGateway } from "../core/contracts";
import {
  buildFillPrompt,
  cmFromImperial,
  coreAnswersSchema,
  dobFillSchema,
  EMPTY_GOALS,
  fillAnswer,
  fillQuestionKeyEnum,
  gramsFromKg,
  gramsFromLb,
  hasAtLeastOneDomain,
  imperialFromCm,
  kgFromGrams,
  lbFromGrams,
  onboardingDraftSchema,
  ONBOARDING_DRAFT_VERSION,
  readFillEnvelope,
  readOnboardingDraft,
  voiceFillSchemas,
  type FillQuestionKey,
  type OnboardingDraft,
} from "../core/onboarding";
import { FakeLlmGateway } from "../providers/fake/llm";

const VALID_ANSWERS = {
  displayName: "Satvik",
  birthDate: "1998-03-14",
  heightCm: 178,
  weightGrams: 74000,
  unitSystem: "metric" as const,
  dayShape: "nine_to_five" as const,
  wakeTimeMinutes: 360,
  sleepTimeMinutes: 1380,
  goals: { health: ["gym" as const], money: [], habits: [], skillName: null },
  timeBudgetMinutes: 30,
};

test("coreAnswersSchema accepts a well-formed all-integer answer set", () => {
  assert.ok(coreAnswersSchema.safeParse(VALID_ANSWERS).success);
});

test("coreAnswersSchema rejects a non-integer (float) quantity — no floats ever", () => {
  const floatHeight = coreAnswersSchema.safeParse({ ...VALID_ANSWERS, heightCm: 178.5 });
  assert.equal(floatHeight.success, false);
  const floatWeight = coreAnswersSchema.safeParse({ ...VALID_ANSWERS, weightGrams: 74000.1 });
  assert.equal(floatWeight.success, false);
  const floatBudget = coreAnswersSchema.safeParse({ ...VALID_ANSWERS, timeBudgetMinutes: 29.9 });
  assert.equal(floatBudget.success, false);
});

test("imperial→metric helpers produce integer metric values and round-trip", () => {
  const cm = cmFromImperial(5, 10);
  assert.equal(cm, 178);
  assert.ok(Number.isInteger(cm));

  const back = imperialFromCm(178);
  assert.deepEqual(back, { feet: 5, inches: 10 });
  assert.ok(Number.isInteger(back.feet) && Number.isInteger(back.inches));

  const grams = gramsFromLb(163);
  assert.ok(Number.isInteger(grams));
  assert.equal(grams, Math.round(163 * 453.59237));
  assert.equal(lbFromGrams(grams), 163);

  assert.equal(gramsFromKg(74), 74000);
  assert.equal(kgFromGrams(74000), 74);
});

test("hasAtLeastOneDomain — B5 requires ≥1 domain (chip OR named skill)", () => {
  assert.equal(hasAtLeastOneDomain(EMPTY_GOALS), false);
  assert.equal(hasAtLeastOneDomain({ ...EMPTY_GOALS, health: ["gym"] }), true);
  assert.equal(hasAtLeastOneDomain({ ...EMPTY_GOALS, money: ["budget"] }), true);
  assert.equal(hasAtLeastOneDomain({ ...EMPTY_GOALS, skillName: "Guitar" }), true);
  // Whitespace-only skill name does not count as a selection.
  assert.equal(hasAtLeastOneDomain({ ...EMPTY_GOALS, skillName: "   " }), false);
});

test("onboarding draft round-trips; a version/shape mismatch discards to null", () => {
  const draft: OnboardingDraft = {
    version: ONBOARDING_DRAFT_VERSION,
    screen: "body",
    answers: { displayName: "Satvik", heightCm: 178 },
  };
  const serialized = JSON.stringify(draft);
  assert.deepEqual(readOnboardingDraft(JSON.parse(serialized)), draft);
  assert.ok(onboardingDraftSchema.safeParse(draft).success);

  // A stale version is not restored — the user starts fresh, never on a wrong shape.
  assert.equal(readOnboardingDraft({ ...draft, version: 0 }), null);
  assert.equal(readOnboardingDraft({ screen: "body" }), null);
  assert.equal(readOnboardingDraft("garbage"), null);
});

test("fill prompt envelope round-trips; malformed prompts read as null", () => {
  for (const key of fillQuestionKeyEnum.options) {
    const prompt = buildFillPrompt(key, "I'm 71 kilos, around 5'10\"");
    const read = readFillEnvelope(prompt);
    assert.deepEqual(read, { questionKey: key, text: "I'm 71 kilos, around 5'10\"" });
  }
  assert.equal(readFillEnvelope("no envelope here"), null);
});

test("fillAnswer returns deterministic canned fields for every question (keyless)", async () => {
  const llm = new FakeLlmGateway();
  for (const key of fillQuestionKeyEnum.options as readonly FillQuestionKey[]) {
    const result = await fillAnswer({ questionKey: key, text: "spoken answer" }, llm);
    assert.ok(result.ok, `fill ${key} should succeed on the fake`);
    if (result.ok) {
      // Fields validate against that question's schema — never a silent malformed write.
      assert.ok(voiceFillSchemas[key].safeParse(result.fields).success);
    }
  }
});

test("a blank utterance fails with zero fields and NEVER calls the gateway", async () => {
  let calls = 0;
  const spy: LlmGateway = {
    async generateObject() {
      calls += 1;
      throw new Error("should not be called for a blank utterance");
    },
    async generateText() {
      throw new Error("unused");
    },
  };
  const result = await fillAnswer({ questionKey: "name", text: "   " }, spy);
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test("a gateway failure yields a retryable fill with zero fields (zero side effects)", async () => {
  const throwing: LlmGateway = {
    async generateObject() {
      throw new Error("provider unavailable");
    },
    async generateText() {
      throw new Error("provider unavailable");
    },
  };
  const result = await fillAnswer({ questionKey: "body", text: "5 foot 10" }, throwing);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.retryable, true);
});

test("the fake gateway THROWS on the onboarding-spine op (no silent fixture fallback)", async () => {
  // deriveSpine lands in Pass 2; on the fake stack a spine call must fail loudly rather
  // than return the brief fixture. Guards a Pass-2 refactor from restoring that fallback.
  const llm = new FakeLlmGateway();
  await assert.rejects(
    () =>
      llm.generateObject({
        tier: "deep",
        schema: coreAnswersSchema,
        system: "",
        prompt: "",
        telemetry: { operation: "onboarding-spine" },
      }),
    /onboarding-spine/,
  );
});

test("birthDate rejects impossible + future dates on BOTH the CORE and DOB-fill schemas", () => {
  const impossible = "2999-13-45"; // month 13, day 45 — regex alone would let this pass
  const future = "2999-01-01"; // a real date, but clearly in the future

  for (const bad of [impossible, future]) {
    assert.equal(
      coreAnswersSchema.safeParse({ ...VALID_ANSWERS, birthDate: bad }).success,
      false,
      `coreAnswersSchema must reject ${bad}`,
    );
    // The DOB voice-fill schema is the Pass-2 injection surface — it must reject too, so a
    // hallucinated provider fill can never inject an impossible/future date.
    assert.equal(dobFillSchema.safeParse({ birthDate: bad }).success, false, `dobFillSchema must reject ${bad}`);
  }

  // A real, past date still passes both — the guard doesn't over-reject valid birthdates.
  assert.ok(coreAnswersSchema.safeParse(VALID_ANSWERS).success);
  assert.ok(dobFillSchema.safeParse({ birthDate: "1998-03-14" }).success);
});
