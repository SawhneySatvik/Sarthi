/**
 * core/domains/health.ts — SAR-006 (D-J). The pure, framework-clean Health lens
 * read-model: the day's Health entries → three glanceable ring metrics (energy /
 * water / protein) + the entry rows. Deterministic, integer-safe, no framework/DB
 * import (invariant #9). Type-only DTO edge, like `core/domains/today.ts`.
 */
import type { MealRecord, WaterLogRecord, WeighInRecord, WorkoutRecord } from "@/data/schema/contract";

export interface HealthTargets {
  energyKcal: number;
  waterMl: number;
  proteinGrams: number;
}

/** Sensible defaults until per-user targets land (spec-silent; tuned later). */
export const DEFAULT_HEALTH_TARGETS: HealthTargets = { energyKcal: 2000, waterMl: 2500, proteinGrams: 60 };

export type HealthRingKey = "energy" | "water" | "protein";

export interface HealthRing {
  key: HealthRingKey;
  label: string;
  value: number;
  target: number;
  unit: string;
  /** value/target clamped to [0,1] for the arc; the raw value/target drive the label. */
  fraction: number;
}

export interface HealthEntryRow {
  id: string;
  kind: "meal" | "water" | "workout" | "weighIn";
  title: string;
  meta: string;
  estimated: boolean;
}

export interface HealthView {
  rings: HealthRing[];
  /** Energy burned (workout kcal), shown alongside the energy ring ("in vs out"). */
  energyOut: number;
  entries: HealthEntryRow[];
}

export interface HealthInput {
  meals: readonly MealRecord[];
  waterLogs: readonly WaterLogRecord[];
  workouts: readonly WorkoutRecord[];
  weighIns: readonly WeighInRecord[];
  targets?: HealthTargets;
}

function sumInts(values: readonly (number | null)[]): number {
  let total = 0;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) total += value;
  }
  return total;
}

function ring(key: HealthRingKey, label: string, value: number, target: number, unit: string): HealthRing {
  return { key, label, value, target, unit, fraction: target > 0 ? Math.min(value / target, 1) : 0 };
}

export function buildHealthView(input: HealthInput): HealthView {
  const targets = input.targets ?? DEFAULT_HEALTH_TARGETS;
  const energyIn = sumInts(input.meals.map((m) => m.kcal));
  const energyOut = sumInts(input.workouts.map((w) => w.burnKcal));
  const water = sumInts(input.waterLogs.map((w) => w.millilitres));
  const protein = sumInts(input.meals.map((m) => m.proteinGrams));

  const entries: HealthEntryRow[] = [];
  for (const m of input.meals) {
    entries.push({ id: m.id, kind: "meal", title: "Meal", meta: `${m.kcal ?? 0} kcal`, estimated: m.estimated });
  }
  for (const w of input.waterLogs) {
    entries.push({ id: w.id, kind: "water", title: "Water", meta: `${w.millilitres} ml`, estimated: w.estimated });
  }
  for (const w of input.workouts) {
    entries.push({ id: w.id, kind: "workout", title: "Workout", meta: `${w.durationMinutes ?? 0} min`, estimated: w.estimated });
  }
  for (const w of input.weighIns) {
    entries.push({
      id: w.id,
      kind: "weighIn",
      title: "Weigh-in",
      meta: `${Math.round((w.weightGrams ?? 0) / 100) / 10} kg`,
      estimated: w.estimated,
    });
  }

  return {
    rings: [
      ring("energy", "Energy", energyIn, targets.energyKcal, "kcal"),
      ring("water", "Water", water, targets.waterMl, "ml"),
      ring("protein", "Protein", protein, targets.proteinGrams, "g"),
    ],
    energyOut,
    entries,
  };
}
