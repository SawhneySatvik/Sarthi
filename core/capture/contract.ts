/**
 * core/capture/contract.ts — the versioned capture contract (SAR-004, D-A).
 *
 * Mirrors ARCHITECTURE §5 as Zod. Two layers, one file:
 *
 *   1. DRAFT-PERMISSIVE  (`captureDraftSchema` / `proposalSchema`) — what the deep
 *      tier returns. Permits `null` ONLY where "explicitly mentioned but quantity
 *      unknown" must be representable: `water.millilitres` (the canonical fixture
 *      says "drank a bottle" with an unknown volume). Everything else is a
 *      non-negative integer. A draft is never persisted directly.
 *
 *   2. RESOLVED-STRICT   (`resolvedProposalSchema`) — the commit input. Primary
 *      quantities are NON-NULL integers, name→entity resolution ids are present,
 *      and `status ∈ {auto, accepted}`. A null primary quantity can never reach a
 *      repository, so invariant #1 (nothing estimated writes unconfirmed) holds by
 *      construction.
 *
 * Framework-clean: imports zod only. The proposal `direction` is `expense|income`
 * (mapped to the schema's `debit|credit` at the commit dispatch, not here); the
 * proposal domain is the four real domains (no `overall`).
 */
import { z } from "zod";

/* ── Enums ──────────────────────────────────────────────────────────────── */

export const proposalDomainEnum = z.enum(["health", "money", "habits", "skills"]);
export const proposalIntentEnum = z.enum(["create", "correction", "backdate"]);
export const proposalStatusEnum = z.enum(["auto", "pending", "accepted", "discarded"]);
export const proposalKindEnum = z.enum([
  "transaction",
  "meal",
  "water",
  "workout",
  "weighIn",
  "habitLog",
  "skillSession",
]);
export const captureSourceEnum = z.enum(["voice", "text", "photo", "mixed"]);
export const proposalDirectionEnum = z.enum(["expense", "income"]);
export const habitLogStatusEnum = z.enum(["done", "skipped"]);
/** Route/commit lifecycle a resolved proposal may carry. Pending/discarded never commit. */
export const resolvedStatusEnum = z.enum(["auto", "accepted"]);

export type ProposalDomain = z.infer<typeof proposalDomainEnum>;
export type ProposalIntent = z.infer<typeof proposalIntentEnum>;
export type ProposalStatus = z.infer<typeof proposalStatusEnum>;
export type ProposalKind = z.infer<typeof proposalKindEnum>;
export type CaptureSource = z.infer<typeof captureSourceEnum>;

/* ── Shared sub-shapes ──────────────────────────────────────────────────── */

const confidenceBps = z.number().int().min(0).max(10000);
const intCount = z.number().int().nonnegative();

export const whySchema = z.object({
  basis: z.string(),
  assumptions: z.array(z.string()),
});

/** Pre-commit evidence handle. SAR-011 (vision) owns the real shape; always empty here. */
export const draftEvidenceRefSchema = z.object({
  ref: z.string(),
  mimeType: z.string().nullable(),
  sha256: z.string().nullable(),
  caption: z.string().nullable(),
});

/** A blocking clarification: nothing it blocks may auto-file until answered (rule 7). */
export const clarificationQuestionSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  blocksProposalIds: z.array(z.string()),
  options: z.array(z.string()).nullable(),
});

export const mealItemInputSchema = z.object({
  name: z.string(),
  quantity: intCount,
  unit: z.string(),
});

export const workoutExerciseInputSchema = z.object({
  name: z.string(),
  sets: intCount.nullable(),
  reps: intCount.nullable(),
  loadGrams: intCount.nullable(),
});

/** Fields every proposal carries (the discriminant `kind` is added per variant). */
const proposalBaseShape = {
  proposalId: z.string(),
  domain: proposalDomainEnum,
  intent: proposalIntentEnum,
  occurredAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  estimated: z.boolean(),
  confidenceBps,
  why: whySchema,
  evidenceRefs: z.array(draftEvidenceRefSchema),
  matchedEntryId: z.string().optional(),
} as const;

/* ── Draft-permissive proposal payloads (§5) ────────────────────────────── */

const transactionDraftPayload = z.object({
  direction: proposalDirectionEnum,
  amountPaise: intCount,
  categoryName: z.string(),
  merchant: z.string().nullable(),
  note: z.string().nullable(),
});
const mealDraftPayload = z.object({
  kcal: intCount,
  proteinGrams: intCount.nullable(),
  carbsGrams: intCount.nullable(),
  fatGrams: intCount.nullable(),
  items: z.array(mealItemInputSchema),
  note: z.string().nullable(),
});
// Draft-permissive: "drank a bottle" — the volume may be explicitly unknown.
const waterDraftPayload = z.object({ millilitres: intCount.nullable() });
const workoutDraftPayload = z.object({
  durationMinutes: intCount,
  burnKcal: intCount.nullable(),
  exercises: z.array(workoutExerciseInputSchema),
  note: z.string().nullable(),
});
const weighInDraftPayload = z.object({ weightGrams: intCount });
const habitLogDraftPayload = z.object({
  habitName: z.string(),
  status: habitLogStatusEnum,
  note: z.string().nullable(),
});
const skillSessionDraftPayload = z.object({
  skillName: z.string(),
  minutes: intCount,
  note: z.string().nullable(),
});

const proposalVariant = <K extends ProposalKind, P extends z.ZodTypeAny>(kind: K, payload: P) =>
  z.object({ ...proposalBaseShape, kind: z.literal(kind), payload });

export const proposalSchema = z.discriminatedUnion("kind", [
  proposalVariant("transaction", transactionDraftPayload),
  proposalVariant("meal", mealDraftPayload),
  proposalVariant("water", waterDraftPayload),
  proposalVariant("workout", workoutDraftPayload),
  proposalVariant("weighIn", weighInDraftPayload),
  proposalVariant("habitLog", habitLogDraftPayload),
  proposalVariant("skillSession", skillSessionDraftPayload),
]);

export const captureDraftSchema = z.object({
  version: z.literal(1),
  draftId: z.string(),
  rawText: z.string(),
  capturedAt: z.string(),
  timezone: z.string(),
  source: captureSourceEnum,
  transcriptConfidenceBps: confidenceBps.nullable(),
  evidenceRefs: z.array(draftEvidenceRefSchema),
  proposals: z.array(proposalSchema),
  questions: z.array(clarificationQuestionSchema),
});

export type Proposal = z.infer<typeof proposalSchema>;
export type CaptureDraft = z.infer<typeof captureDraftSchema>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type DraftEvidenceRef = z.infer<typeof draftEvidenceRefSchema>;
export type MealItemInput = z.infer<typeof mealItemInputSchema>;
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseInputSchema>;

/* ── Resolved-strict commit input ───────────────────────────────────────────
 * The commit contract. Primary quantities are NON-NULL; name→entity resolution
 * ids are present; `status ∈ {auto, accepted}`. Secondary/optional fields (macros,
 * merchant, notes) keep their nullability — only the load-bearing quantity that a
 * write depends on is forced non-null, so a null value can never be persisted.
 */
const resolvedBaseShape = {
  ...proposalBaseShape,
  status: resolvedStatusEnum,
} as const;

const transactionResolvedPayload = z.object({
  direction: proposalDirectionEnum,
  amountPaise: intCount, // non-null
  categoryId: z.string().nullable(), // resolved id, or null = explicitly uncategorized
  merchant: z.string().nullable(),
  note: z.string().nullable(),
});
const mealResolvedPayload = mealDraftPayload; // kcal already non-null; macros stay nullable
const waterResolvedPayload = z.object({ millilitres: intCount }); // NON-NULL (strictness point)
const workoutResolvedPayload = workoutDraftPayload;
const weighInResolvedPayload = weighInDraftPayload;
const habitLogResolvedPayload = z.object({
  habitId: z.string(), // resolved (never invented)
  status: habitLogStatusEnum,
  note: z.string().nullable(),
});
const skillSessionResolvedPayload = z.object({
  skillId: z.string(), // resolved (never invented)
  minutes: intCount, // non-null
  note: z.string().nullable(),
});

const resolvedVariant = <K extends ProposalKind, P extends z.ZodTypeAny>(kind: K, payload: P) =>
  z.object({ ...resolvedBaseShape, kind: z.literal(kind), payload });

export const resolvedProposalSchema = z.discriminatedUnion("kind", [
  resolvedVariant("transaction", transactionResolvedPayload),
  resolvedVariant("meal", mealResolvedPayload),
  resolvedVariant("water", waterResolvedPayload),
  resolvedVariant("workout", workoutResolvedPayload),
  resolvedVariant("weighIn", weighInResolvedPayload),
  resolvedVariant("habitLog", habitLogResolvedPayload),
  resolvedVariant("skillSession", skillSessionResolvedPayload),
]);

export type ResolvedProposal = z.infer<typeof resolvedProposalSchema>;

export const CAPTURE_CONTRACT_VERSION = 1 as const;
