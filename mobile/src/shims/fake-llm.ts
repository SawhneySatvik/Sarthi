import { z } from "zod";

export const CANONICAL_CROSS_DOMAIN_DUMP =
  "Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design, woke at 5:10";

const proposalSchema = z.object({
  proposalId: z.string(),
  domain: z.enum(["health", "money", "habits", "skills"]),
  kind: z.enum(["transaction", "meal", "water", "habitLog", "skillSession"]),
  intent: z.literal("create"),
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  estimated: z.boolean(),
  confidenceBps: z.number().int(),
  why: z.object({ basis: z.string(), assumptions: z.array(z.string()) }),
  evidenceRefs: z.array(z.unknown()),
  payload: z.record(z.string(), z.unknown()),
});

export const captureDraftSchema = z.object({
  version: z.literal(1),
  draftId: z.string(),
  rawText: z.string(),
  capturedAt: z.string(),
  timezone: z.string(),
  source: z.enum(["voice", "text", "photo", "mixed"]),
  transcriptConfidenceBps: z.number().int().nullable(),
  evidenceRefs: z.array(z.unknown()),
  proposals: z.array(proposalSchema),
  questions: z.array(z.unknown()),
});

export type CaptureDraft = z.infer<typeof captureDraftSchema>;

const capturedAt = "2026-07-17T05:15:00.000Z";
const occurredAt = capturedAt;
const timezone = "Asia/Kolkata";

const canonicalDraft = {
  version: 1,
  draftId: "fake-canonical-cross-domain-v1",
  rawText: CANONICAL_CROSS_DOMAIN_DUMP,
  capturedAt,
  timezone,
  source: "voice",
  transcriptConfidenceBps: 9800,
  evidenceRefs: [],
  proposals: [
    {
      proposalId: "fake-transaction-lunch-v1", domain: "money", kind: "transaction", intent: "create", occurredAt, localDate: "2026-07-17", timezone, estimated: false, confidenceBps: 9800,
      why: { basis: "explicit spoken amount and meal purchase", assumptions: [] }, evidenceRefs: [],
      payload: { direction: "expense", amountPaise: 34000, categoryName: "Food & dining", merchant: null, note: "Lunch" },
    },
    {
      proposalId: "fake-meal-lunch-v1", domain: "health", kind: "meal", intent: "create", occurredAt, localDate: "2026-07-17", timezone, estimated: true, confidenceBps: 7600,
      why: { basis: "meal composition inferred from spoken food", assumptions: ["portion sizes are estimated"] }, evidenceRefs: [],
      payload: { kcal: 520, proteinGrams: 18, carbsGrams: 82, fatGrams: 14, note: "Lunch" },
    },
    {
      proposalId: "fake-skill-system-design-v1", domain: "skills", kind: "skillSession", intent: "create", occurredAt, localDate: "2026-07-17", timezone, estimated: false, confidenceBps: 9700,
      why: { basis: "explicit spoken duration and skill", assumptions: [] }, evidenceRefs: [],
      payload: { skillName: "System design", minutes: 90, note: null },
    },
    {
      proposalId: "fake-habit-wake-v1", domain: "habits", kind: "habitLog", intent: "create", occurredAt: "2026-07-17T05:10:00.000Z", localDate: "2026-07-17", timezone, estimated: false, confidenceBps: 8600,
      why: { basis: "wake time is explicit but requires matching an existing habit", assumptions: [] }, evidenceRefs: [],
      payload: { habitName: "Wake by 5:30 AM", status: "done", note: "Woke at 5:10" },
    },
  ],
  questions: [],
} as const;

export class FakeLlmGateway {
  async generateObject<TSchema extends z.ZodType>(schema: TSchema): Promise<z.infer<TSchema>> {
    return schema.parse(canonicalDraft);
  }
}
