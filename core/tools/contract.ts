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
