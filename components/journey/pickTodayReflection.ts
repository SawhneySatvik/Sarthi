import type { DailyReflectionRecord } from "@/data/schema/contract";

/**
 * DATA-LOSS guard (UIE-3): the reflection editor may only ever pre-fill from TODAY's own
 * record. A returning user on a fresh day has no today-entry — this returns `null` so the
 * form starts clean and Save creates a new day, never silently overwriting a past day whose
 * upsert key (`localDate`) would otherwise be reused. Pure + framework-free so it is unit-testable.
 */
export function pickTodayReflection(
  reflections: readonly DailyReflectionRecord[],
  today: string,
): DailyReflectionRecord | null {
  return reflections.find((item) => item.localDate === today) ?? null;
}
