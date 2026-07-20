/**
 * core/capture/vision.ts — the photo entry ramp (SAR-011, D-A/D-B).
 *
 * A meal or receipt photo must merge into the SAME parse → route → commit loop the
 * text path already runs. This module is the ramp and NOTHING more: it defines the
 * vision result contract, maps a vision result into a real `CaptureDraft`, and runs
 * the deep-tier vision call keylessly through the injected `VisionProvider`. The ramp
 * ENDS at `CaptureDraft` — routing, the deck, commit, and undo are the untouched
 * existing pipeline.
 *
 * Two invariants live here by construction:
 *   • #1 (nothing estimated writes unconfirmed) — the meal is FORCED `estimated:true`,
 *     and every derived proposal carries a photo `DraftEvidenceRef` so the new §5.1
 *     rule-4 routing reason ("photo-derived value ⇒ pending") fires. No photo value
 *     can ever auto-write, even an explicit receipt amount.
 *   • #2 (integer units) — the schemas are non-negative integers (paise/kcal/grams);
 *     the mapper is passthrough only — no arithmetic, no float.
 *
 * Framework-clean: imports zod, core contracts/types, the shared `@/core/time` day
 * helpers, and `node:crypto` only (the same node-stdlib posture as `commit.ts`). No
 * provider, DB, React, or Next.
 */
import { randomUUID } from "node:crypto";

import type { ImageInput, VisionProvider } from "@/core/contracts";
import { localDateInZone } from "@/core/time";
import { z } from "zod";

import {
  captureDraftSchema,
  type CaptureDraft,
  type DraftEvidenceRef,
  type Proposal,
} from "./contract";
import type { ParseResult } from "./parse";

/** The individual proposal shapes SAR-011 emits (the contract exports only the union). */
type MealProposal = Extract<Proposal, { kind: "meal" }>;
type TransactionProposal = Extract<Proposal, { kind: "transaction" }>;

/* ── Vision result contract (D-A) ─────────────────────────────────────────────
 * What the vision model returns — a schema-generic shape the provider validates.
 * Discriminated on `kind`; every quantity is a non-negative integer (invariant #2).
 * This is NOT a `CaptureDraft`; `draftFromVisionResult` maps it into one.
 */
const confidenceBps = z.number().int().min(0).max(10000);
const intCount = z.number().int().nonnegative();
const visionDirectionEnum = z.enum(["expense", "income"]);

/** The UI type toggle (override #1) — the selected type drives the fake fixture. */
export const visionPhotoTypeEnum = z.enum(["meal", "receipt"]);
export type VisionPhotoType = z.infer<typeof visionPhotoTypeEnum>;

export const visionMealItemSchema = z.object({
  name: z.string(),
  quantity: intCount,
  unit: z.string(),
});

export const visionMealResultSchema = z.object({
  kind: z.literal("meal"),
  confidenceBps,
  meal: z.object({
    kcal: intCount,
    proteinGrams: intCount.nullable(),
    carbsGrams: intCount.nullable(),
    fatGrams: intCount.nullable(),
    items: z.array(visionMealItemSchema),
    note: z.string().nullable(),
  }),
});

export const visionReceiptTransactionSchema = z.object({
  amountPaise: intCount,
  direction: visionDirectionEnum,
  categoryName: z.string(),
  merchant: z.string().nullable(),
  note: z.string().nullable(),
});

export const visionReceiptResultSchema = z.object({
  kind: z.literal("receipt"),
  confidenceBps,
  merchant: z.string().nullable(),
  purchasedLocalDate: z.string().nullable(),
  transactions: z.array(visionReceiptTransactionSchema),
});

export const visionResultSchema = z.discriminatedUnion("kind", [
  visionMealResultSchema,
  visionReceiptResultSchema,
]);

export type VisionMealResult = z.infer<typeof visionMealResultSchema>;
export type VisionReceiptResult = z.infer<typeof visionReceiptResultSchema>;
export type VisionResult = z.infer<typeof visionResultSchema>;

/* ── Mapper (D-A) ──────────────────────────────────────────────────────────── */

export interface VisionDraftContext {
  /** Deterministic draft id (`photo-<uuid>`); proposal ids derive from it. */
  draftId: string;
  /** UTC ISO timestamp the photo was captured. */
  capturedAt: string;
  /** IANA zone captured at entry — `localDate` is computed in this zone. */
  timezone: string;
  /** Optional user caption; becomes the draft `rawText` when present. */
  caption?: string | null;
  /** The uploaded image mime, carried onto the evidence ref (never a stored blob). */
  mimeType?: string | null;
}

// `localDateInZone` now lives in the shared `@/core/time` module (D-053) — the private
// copy that used to sit here was lifted verbatim into it. Behavior is identical.

/** The single photo evidence handle attached to the draft AND every derived proposal. */
function photoEvidenceRef(ctx: VisionDraftContext): DraftEvidenceRef {
  return {
    ref: `photo:${ctx.draftId}`,
    mimeType: ctx.mimeType ?? null,
    sha256: null, // no blob is hashed or stored — persistence is a later ticket
    caption: ctx.caption ?? null,
  };
}

function mealProposal(result: VisionMealResult, ctx: VisionDraftContext): MealProposal {
  const localDate = localDateInZone(ctx.capturedAt, ctx.timezone);
  return {
    proposalId: `${ctx.draftId}-meal`,
    domain: "health",
    kind: "meal",
    intent: "create",
    occurredAt: ctx.capturedAt,
    localDate,
    timezone: ctx.timezone,
    // Invariant #1: a photo meal is ALWAYS an estimate — forced here regardless of
    // what the model claimed, so it can only ever surface as a confirm card.
    estimated: true,
    confidenceBps: result.confidenceBps,
    why: {
      basis: "estimated from a meal photo",
      assumptions: ["portion sizes inferred from the image"],
    },
    evidenceRefs: [photoEvidenceRef(ctx)],
    payload: {
      kcal: result.meal.kcal,
      proteinGrams: result.meal.proteinGrams,
      carbsGrams: result.meal.carbsGrams,
      fatGrams: result.meal.fatGrams,
      items: result.meal.items,
      note: result.meal.note,
    },
  };
}

function receiptProposals(result: VisionReceiptResult, ctx: VisionDraftContext): TransactionProposal[] {
  const capturedLocalDate = localDateInZone(ctx.capturedAt, ctx.timezone);
  const localDate = result.purchasedLocalDate ?? capturedLocalDate;
  const evidence = photoEvidenceRef(ctx);
  return result.transactions.map((txn, index) => ({
    proposalId: `${ctx.draftId}-txn-${index}`,
    domain: "money",
    kind: "transaction",
    intent: "create",
    occurredAt: ctx.capturedAt,
    localDate,
    timezone: ctx.timezone,
    // Printed values are explicit (estimated:false) — the pending routing comes from
    // the photo-evidence rule, NOT from an estimate flag; §5.1 rule 4.
    estimated: false,
    confidenceBps: result.confidenceBps,
    why: { basis: "read from a receipt photo", assumptions: [] },
    evidenceRefs: [evidence],
    payload: {
      direction: txn.direction,
      amountPaise: txn.amountPaise,
      categoryName: txn.categoryName,
      merchant: txn.merchant ?? result.merchant,
      note: txn.note,
    },
  }));
}

/**
 * PURE map of a validated vision result → a real `CaptureDraft`. Meal ⇒ one forced
 * estimate proposal; receipt ⇒ N explicit transaction proposals. Every proposal (and
 * the draft) carries the photo evidence ref that forces route-to-pending. Deterministic
 * given its inputs — the fixture/eval build receipt drafts through this exact function.
 */
export function draftFromVisionResult(result: VisionResult, ctx: VisionDraftContext): CaptureDraft {
  const proposals =
    result.kind === "meal" ? [mealProposal(result, ctx)] : receiptProposals(result, ctx);
  const rawText = ctx.caption ?? (result.kind === "meal" ? "Meal photo" : "Receipt photo");
  return {
    version: 1,
    draftId: ctx.draftId,
    rawText,
    capturedAt: ctx.capturedAt,
    timezone: ctx.timezone,
    source: "photo",
    transcriptConfidenceBps: null,
    evidenceRefs: [photoEvidenceRef(ctx)],
    proposals,
    questions: [],
  };
}

/* ── parsePhoto (D-A/D-C) ─────────────────────────────────────────────────────
 * Mirrors `parseDump`: run the deep-tier vision call through the INJECTED provider
 * (fake stack, keyless), defensively re-validate, and map to a draft. Any throw or
 * invalid object ⇒ retryable draft with ZERO rows and zero outbox.
 */
export interface ParsePhotoInput {
  images: readonly ImageInput[];
  timezone: string;
  capturedAt: string;
  /** Override #1: the UI toggle selects the fixture the fake vision provider returns. */
  photoType: VisionPhotoType;
  caption?: string | null;
}

/**
 * The prompt embeds the selected type so the deterministic `FakeVisionProvider`
 * (prompt-keyed) returns the matching canned fixture — a live snap is tagged by the
 * toggle, demo-safe. Content-based discrimination is the real adapter's job (later).
 */
function promptFor(photoType: VisionPhotoType): string {
  return photoType === "receipt"
    ? "Read this receipt photo and return the printed transactions as typed money entries."
    : "Analyze this meal photo and return the estimated nutrition as a typed meal entry.";
}

export async function parsePhoto(input: ParsePhotoInput, vision: VisionProvider): Promise<ParseResult> {
  try {
    const result = await vision.analyze({
      images: input.images,
      schema: visionResultSchema,
      prompt: promptFor(input.photoType),
      tier: "deep",
    });
    // Defensive re-validation: a malformed vision object must NEVER become rows — it
    // is a retryable draft, not a crash and not a silent write (mirrors parseDump).
    const parsed = visionResultSchema.safeParse(result.object);
    if (!parsed.success) {
      return { ok: false, retryable: true, error: "vision returned an object that failed the vision result schema" };
    }
    const draft = draftFromVisionResult(parsed.data, {
      draftId: `photo-${randomUUID()}`,
      capturedAt: input.capturedAt,
      timezone: input.timezone,
      caption: input.caption ?? null,
      mimeType: input.images[0]?.mimeType ?? null,
    });
    // Belt-and-suspenders: the constructed draft is itself schema-valid before it
    // enters the untouched routing pipeline.
    const validated = captureDraftSchema.safeParse(draft);
    if (!validated.success) {
      return { ok: false, retryable: true, error: "mapped photo draft failed the CaptureDraft schema" };
    }
    return { ok: true, draft: validated.data };
  } catch (error) {
    return { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error) };
  }
}
