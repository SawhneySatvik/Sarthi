/** Framework-clean boundary contracts for the two explicit SAR-016 tool loops. */
import { z } from "zod";

export const toolSkillNameSchema = z.string().trim().min(1).max(80);
export const toolIdempotencyKeySchema = z.string().uuid();
export const toolMinutesSchema = z.number().int().min(1).max(24 * 60);

export const createToolSkillInputSchema = z.object({ name: toolSkillNameSchema });
export type CreateToolSkillInput = z.infer<typeof createToolSkillInputSchema>;

export const completeFocusInputSchema = z.object({
  skillId: z.string().uuid(),
  minutes: toolMinutesSchema,
  idempotencyKey: toolIdempotencyKeySchema,
});
export type CompleteFocusInput = z.infer<typeof completeFocusInputSchema>;

/** Stable client pattern ids; their labels/durations are display-only and never persisted. */
export const meditationPatternSchema = z.enum(["box", "478", "calm", "ten"]);
export const completeMeditationInputSchema = z.object({
  minutes: toolMinutesSchema,
  patternId: meditationPatternSchema,
  consented: z.boolean(),
  idempotencyKey: toolIdempotencyKeySchema,
});
export type CompleteMeditationInput = z.infer<typeof completeMeditationInputSchema>;
export type MeditationPattern = z.infer<typeof meditationPatternSchema>;

/**
 * Workout Counter (T4 → Health). One explicit, user-entered rep/set log. `sets`/`reps`/
 * `loadGrams` are nullable (a bodyweight or duration-only set records no load), grams and
 * minutes are integers, and `burnKcal` is null unless the user explicitly provides it — the
 * tool never fabricates an estimated burn that would auto-write (invariant #1).
 */
export const workoutExerciseEntrySchema = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.number().int().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(10000).nullable(),
  loadGrams: z.number().int().min(0).max(2_000_000).nullable(),
});
export type WorkoutExerciseEntry = z.infer<typeof workoutExerciseEntrySchema>;

export const completeWorkoutInputSchema = z.object({
  durationMinutes: toolMinutesSchema,
  burnKcal: z.number().int().min(0).max(100000).nullable(),
  exercises: z.array(workoutExerciseEntrySchema).max(40),
  idempotencyKey: toolIdempotencyKeySchema,
});
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutInputSchema>;
