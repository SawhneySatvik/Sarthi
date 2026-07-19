/**
 * tests/onboarding-spine.test.ts — SAR-012 Pass 2 (D-E). Keyless, network-free.
 * `deriveSpine` is deterministic and ANSWER-DERIVED (the glass-box property): the
 * time-budget/day-shape scaling is visible in the targets + headerLine, the under-18
 * branch is conservative (no weight-loss framing), the per-domain schemas hold, the
 * prompt envelope round-trips, and the fake gateway returns the same answer-derived spine
 * (never a silent fixture fallback).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSpinePrompt,
  coreAnswersSchema,
  deriveSpine,
  generateSpine,
  habitsSpineSchema,
  healthSpineSchema,
  moneySpineSchema,
  readSpineEnvelope,
  selectedSpineDomains,
  skillsSpineSchema,
  spineSchemaFor,
  type CoreAnswers,
  type HealthSpine,
  type SkillsSpine,
} from "../core/onboarding";
import { FakeLlmGateway } from "../providers/fake/llm";

const BASE_ANSWERS: CoreAnswers = {
  displayName: "Satvik",
  birthDate: "1998-03-14", // adult
  heightCm: 178,
  weightGrams: 74000, // 74 kg → maintenance 2220 kcal
  unitSystem: "metric",
  dayShape: "nine_to_five",
  wakeTimeMinutes: 330, // 05:30
  sleepTimeMinutes: 1380, // 23:00
  goals: {
    health: ["gym", "weight"],
    money: ["budget", "stop_leaks"],
    habits: ["wake_early", "focus"],
    skillName: "System design",
  },
  timeBudgetMinutes: 30,
};

const kcalTarget = (spine: HealthSpine) => spine.targets.find((t) => t.targetUnit === "kcal");
const workoutTarget = (spine: HealthSpine) => spine.targets.find((t) => t.targetUnit === "minutes");

test("BASE_ANSWERS is a well-formed CoreAnswers set (integers throughout)", () => {
  assert.ok(coreAnswersSchema.safeParse(BASE_ANSWERS).success);
});

test("deriveSpine is deterministic — same answers, identical spine", () => {
  for (const domain of selectedSpineDomains(BASE_ANSWERS)) {
    assert.deepEqual(deriveSpine(domain, BASE_ANSWERS), deriveSpine(domain, BASE_ANSWERS));
  }
});

test("each domain spine validates against its own schema", () => {
  assert.ok(healthSpineSchema.safeParse(deriveSpine("health", BASE_ANSWERS)).success);
  assert.ok(moneySpineSchema.safeParse(deriveSpine("money", BASE_ANSWERS)).success);
  assert.ok(habitsSpineSchema.safeParse(deriveSpine("habits", BASE_ANSWERS)).success);
  assert.ok(skillsSpineSchema.safeParse(deriveSpine("skills", BASE_ANSWERS)).success);
});

test("the time budget scales targets AND the headerLine (glass-box)", () => {
  const small = deriveSpine("health", { ...BASE_ANSWERS, timeBudgetMinutes: 30 }) as HealthSpine;
  const large = deriveSpine("health", { ...BASE_ANSWERS, timeBudgetMinutes: 120 }) as HealthSpine;
  assert.equal(workoutTarget(small)?.targetValue, 30);
  assert.equal(workoutTarget(large)?.targetValue, 60); // capped at 60, but visibly larger
  assert.ok(small.headerLine.includes("30 minutes"));
  assert.ok(large.headerLine.includes("120 minutes"));

  // Skills practice minutes scale with the budget too (15 → 15, 120 → 90).
  const skillSmall = deriveSpine("skills", { ...BASE_ANSWERS, timeBudgetMinutes: 15 }) as SkillsSpine;
  const skillLarge = deriveSpine("skills", { ...BASE_ANSWERS, timeBudgetMinutes: 120 }) as SkillsSpine;
  assert.equal(skillSmall.items[0].targetValue, 15);
  assert.equal(skillLarge.items[0].targetValue, 90);
});

test("the day shape appears in every headerLine (glass-box derivation)", () => {
  const founder = deriveSpine("habits", { ...BASE_ANSWERS, dayShape: "founder" });
  const student = deriveSpine("habits", { ...BASE_ANSWERS, dayShape: "student" });
  assert.ok(founder.headerLine.includes("founder/freelance"));
  assert.ok(student.headerLine.includes("student"));
});

test("the named skill carries through verbatim", () => {
  const spine = deriveSpine("skills", { ...BASE_ANSWERS, goals: { ...BASE_ANSWERS.goals, skillName: "Watercolour" } }) as SkillsSpine;
  assert.equal(spine.skill.name, "Watercolour");
  assert.ok(spine.headerLine.includes("Watercolour"));
  assert.ok(spine.items[0].linkSkillName === "Watercolour");
});

test("under-18 Health is conservative — no deficit, no weigh-in, gentler headerLine", () => {
  const minor: CoreAnswers = {
    ...BASE_ANSWERS,
    birthDate: "2013-01-01", // ~13 in 2026 — safely under 18, clock-independent
    weightGrams: 50000, // 50 kg → maintenance 1500 kcal
    goals: { ...BASE_ANSWERS.goals, health: ["eat_better", "weight"] },
  };
  const adult: CoreAnswers = { ...minor, birthDate: "1990-01-01" };

  const minorSpine = deriveSpine("health", minor) as HealthSpine;
  const adultSpine = deriveSpine("health", adult) as HealthSpine;

  // Adult's weight-goal deficit (1500−300=1200) is clamped up to the 1400 kcal floor; the minor
  // gets maintenance (no deficit), which sits above the floor.
  assert.equal(kcalTarget(minorSpine)?.targetValue, 1500);
  assert.equal(kcalTarget(adultSpine)?.targetValue, 1400);
  // No weigh-in framing for a minor; the adult weight goal adds one.
  assert.ok(!minorSpine.targets.some((t) => t.title.toLowerCase().includes("weigh")));
  assert.ok(adultSpine.targets.some((t) => t.title.toLowerCase().includes("weigh")));
  // The minor never sees weight-loss language.
  assert.ok(!JSON.stringify(minorSpine).toLowerCase().includes("lose"));
  assert.ok(minorSpine.headerLine.includes("gentle"));
});

test("selectedSpineDomains reads the B5 answers (chip or named skill)", () => {
  assert.deepEqual(selectedSpineDomains(BASE_ANSWERS), ["health", "money", "habits", "skills"]);
  const onlySkill: CoreAnswers = {
    ...BASE_ANSWERS,
    goals: { health: [], money: [], habits: [], skillName: "System design" },
  };
  assert.deepEqual(selectedSpineDomains(onlySkill), ["skills"]);
});

test("the spine prompt envelope round-trips (fake and prompt cannot drift)", () => {
  const prompt = buildSpinePrompt("money", BASE_ANSWERS);
  const read = readSpineEnvelope(prompt);
  assert.ok(read);
  assert.equal(read?.domain, "money");
  assert.deepEqual(coreAnswersSchema.parse(read?.answers), BASE_ANSWERS);
  assert.equal(readSpineEnvelope("no envelope here"), null);
});

test("generateSpine on the fake returns the SAME answer-derived spine (keyless)", async () => {
  const llm = new FakeLlmGateway();
  for (const domain of selectedSpineDomains(BASE_ANSWERS)) {
    const result = await generateSpine({ domain, answers: BASE_ANSWERS }, llm);
    assert.ok(result.ok, `generateSpine ${domain} should succeed on the fake`);
    if (result.ok) {
      assert.equal(result.spine.domain, domain);
      assert.deepEqual(result.spine, deriveSpine(domain, BASE_ANSWERS));
      assert.ok(spineSchemaFor(domain).safeParse(result.spine).success);
    }
  }
});

test("the fake THROWS on a spine op with no envelope (no silent fixture fallback)", async () => {
  const llm = new FakeLlmGateway();
  await assert.rejects(
    () =>
      llm.generateObject({
        tier: "deep",
        schema: healthSpineSchema,
        system: "",
        prompt: "no envelope",
        telemetry: { operation: "onboarding-spine" },
      }),
    /onboarding-spine/,
  );
});
