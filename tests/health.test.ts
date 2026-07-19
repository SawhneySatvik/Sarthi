/**
 * tests/health.test.ts — the pure Health lens read-model (SAR-006, D-J). Keyless.
 * Proves the three ring aggregates (energy in / water / protein), energy-out, entry
 * rows, integer-safety over null macros, and fraction clamping.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_HEALTH_TARGETS, buildHealthView } from "../core/domains/health";
import type { MealRecord, WaterLogRecord, WeighInRecord, WorkoutRecord } from "../data/schema/contract";

const BASE = { userId: "local-dev", createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:00.000Z", deletedAt: null, occurredAt: "2026-07-18T00:00:00.000Z", localDate: "2026-07-18", timezone: "UTC", source: "capture", confidenceBps: 9000, estimated: false };

function meal(over: Partial<MealRecord> & { id: string }): MealRecord {
  return { ...BASE, kcal: null, proteinGrams: null, carbsGrams: null, fatGrams: null, evidenceId: null, note: null, ...over } as MealRecord;
}
function water(over: Partial<WaterLogRecord> & { id: string }): WaterLogRecord {
  return { ...BASE, millilitres: 0, ...over } as WaterLogRecord;
}
function workout(over: Partial<WorkoutRecord> & { id: string }): WorkoutRecord {
  return { ...BASE, durationMinutes: null, burnKcal: null, note: null, ...over } as WorkoutRecord;
}
function weighIn(over: Partial<WeighInRecord> & { id: string }): WeighInRecord {
  return { ...BASE, weightGrams: 0, ...over } as WeighInRecord;
}

test("three rings aggregate energy-in / water / protein; energy-out is separate", () => {
  const view = buildHealthView({
    meals: [meal({ id: "m1", kcal: 600, proteinGrams: 20 }), meal({ id: "m2", kcal: 450, proteinGrams: 15 })],
    waterLogs: [water({ id: "w1", millilitres: 500 }), water({ id: "w2", millilitres: 750 })],
    workouts: [workout({ id: "wo1", durationMinutes: 45, burnKcal: 300 })],
    weighIns: [],
  });
  const byKey = Object.fromEntries(view.rings.map((r) => [r.key, r]));
  assert.equal(byKey.energy.value, 1050); // 600 + 450
  assert.equal(byKey.water.value, 1250); // 500 + 750
  assert.equal(byKey.protein.value, 35); // 20 + 15
  assert.equal(view.energyOut, 300);
  assert.equal(byKey.energy.target, DEFAULT_HEALTH_TARGETS.energyKcal);
});

test("null macros contribute 0 (integer-safe); fraction clamps at 1", () => {
  const view = buildHealthView({
    meals: [meal({ id: "m1", kcal: null, proteinGrams: null })],
    waterLogs: [water({ id: "w1", millilitres: 9000 })], // over target
    workouts: [],
    weighIns: [],
    targets: { energyKcal: 2000, waterMl: 2500, proteinGrams: 60 },
  });
  const byKey = Object.fromEntries(view.rings.map((r) => [r.key, r]));
  assert.equal(byKey.energy.value, 0);
  assert.equal(byKey.protein.value, 0);
  assert.equal(byKey.water.fraction, 1); // 9000/2500 clamped
});

test("entry rows cover every health kind with a human meta", () => {
  const view = buildHealthView({
    meals: [meal({ id: "m1", kcal: 600, estimated: true })],
    waterLogs: [water({ id: "w1", millilitres: 500 })],
    workouts: [workout({ id: "wo1", durationMinutes: 30 })],
    weighIns: [weighIn({ id: "wi1", weightGrams: 70500 })],
    targets: DEFAULT_HEALTH_TARGETS,
  });
  assert.equal(view.entries.length, 4);
  const meta = Object.fromEntries(view.entries.map((e) => [e.kind, e.meta]));
  assert.equal(meta.meal, "600 kcal");
  assert.equal(meta.water, "500 ml");
  assert.equal(meta.workout, "30 min");
  assert.equal(meta.weighIn, "70.5 kg");
  assert.equal(view.entries.find((e) => e.kind === "meal")?.estimated, true);
});
