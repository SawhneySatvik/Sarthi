/**
 * tests/fixtures/capture/ — the 7 SAR-004 capture fixtures with their expected
 * routing outcome and typed-row expectations. Steps 4/6/7 (route/commit/undo)
 * consume these; SAR-007's eval harness will consume them too.
 *
 * `draft` is a valid `CaptureDraft` (parses under `captureDraftSchema`), except
 * `provider-failure`, whose `draft` is `null` (parse is expected to fail upstream).
 * `expected.auto`/`expected.pending` list proposalIds by their route GIVEN the
 * seed described in `expected.note` (e.g. the canonical transaction is auto only
 * once its category is seeded — OQ-1 holds §5.1 rule 7).
 */
import {
  captureDraftSchema,
  type CaptureDraft,
  type ClarificationQuestion,
  type Proposal,
} from "../../../core/capture/contract";
import { CANONICAL_CAPTURE_DRAFT_FIXTURE } from "../../../providers/fake/fixtures";

export interface CaptureFixture {
  id: string;
  draft: CaptureDraft | null;
  expectParseError?: boolean;
  expected: {
    auto: string[];
    pending: string[];
    note?: string;
  };
}

const DAY = "2026-07-17";
const AT = "2026-07-17T05:15:00.000Z";
const TZ = "Asia/Kolkata";

function mkDraft(
  draftId: string,
  proposals: Proposal[],
  questions: ClarificationQuestion[] = [],
  source: CaptureDraft["source"] = "text",
): CaptureDraft {
  return {
    version: 1,
    draftId,
    rawText: draftId,
    capturedAt: AT,
    timezone: TZ,
    source,
    transcriptConfidenceBps: null,
    evidenceRefs: [],
    proposals,
    questions,
  };
}

/** Canonical cross-domain dump — parsed from the shipped SAR-002 fixture (extra keys stripped). */
export const canonicalFixture: CaptureFixture = {
  id: "canonical-cross-domain",
  draft: captureDraftSchema.parse(CANONICAL_CAPTURE_DRAFT_FIXTURE),
  expected: {
    // Auto ONLY once the user's "Food & dining" category + "System design" skill are seeded.
    auto: ["fake-transaction-lunch-v1", "fake-skill-system-design-v1"],
    pending: ["fake-meal-lunch-v1", "fake-water-bottle-v1", "fake-habit-wake-v1"],
    note: "seed category 'Food & dining' + skill 'System design' for the 2 auto rows",
  },
};

/** An explicit (not estimated) transaction below the 9000 auto threshold → pending. */
export const explicitLowConfidenceFixture: CaptureFixture = {
  id: "explicit-low-confidence",
  draft: mkDraft("explicit-low-confidence", [
    {
      proposalId: "elc-txn",
      domain: "money",
      kind: "transaction",
      intent: "create",
      occurredAt: AT,
      localDate: DAY,
      timezone: TZ,
      estimated: false,
      confidenceBps: 7200,
      why: { basis: "heard an amount but the transcript was noisy", assumptions: [] },
      evidenceRefs: [],
      payload: { direction: "expense", amountPaise: 12000, categoryName: "Food & dining", merchant: null, note: null },
    },
  ]),
  expected: { auto: [], pending: ["elc-txn"], note: "explicit but <9000 bps → pending, no silent write" },
};

/** A skill session whose skill does not exist for the user → pending question (never invents a skill). */
export const ambiguousSkillFixture: CaptureFixture = {
  id: "ambiguous-skill",
  draft: mkDraft(
    "ambiguous-skill",
    [
      {
        proposalId: "amb-skill",
        domain: "skills",
        kind: "skillSession",
        intent: "create",
        occurredAt: AT,
        localDate: DAY,
        timezone: TZ,
        estimated: false,
        confidenceBps: 9600,
        why: { basis: "explicit minutes but the skill name is not yet tracked", assumptions: [] },
        evidenceRefs: [],
        payload: { skillName: "Underwater basket weaving", minutes: 45, note: null },
      },
    ],
    [
      { questionId: "amb-skill-q", prompt: "Which skill was this?", blocksProposalIds: ["amb-skill"], options: null },
    ],
  ),
  expected: { auto: [], pending: ["amb-skill"], note: "unresolved skill → pending question, no invented skill/session" },
};

/** A correction targeting an existing meal — always pending; on accept updates in place. */
export const correctionExistingEntryFixture: CaptureFixture = {
  id: "correction-existing-entry",
  draft: mkDraft("correction-existing-entry", [
    {
      proposalId: "corr-meal",
      domain: "health",
      kind: "meal",
      intent: "correction",
      occurredAt: AT,
      localDate: DAY,
      timezone: TZ,
      estimated: false,
      confidenceBps: 9500,
      why: { basis: "user corrected the lunch calories", assumptions: [] },
      evidenceRefs: [],
      matchedEntryId: "REPLACE_AT_RUNTIME",
      payload: { kcal: 600, proteinGrams: 20, carbsGrams: 90, fatGrams: 16, items: [], note: "closer to 600" },
    },
  ]),
  expected: { auto: [], pending: ["corr-meal"], note: "correction always pending; accept updates matchedEntryId in place, no duplicate" },
};

/** A backdated habit log (yesterday) — always pending; on accept writes the historical date. */
export const backdateHabitFixture: CaptureFixture = {
  id: "backdate-habit",
  draft: mkDraft("backdate-habit", [
    {
      proposalId: "bd-habit",
      domain: "habits",
      kind: "habitLog",
      intent: "backdate",
      occurredAt: "2026-07-16T23:00:00.000Z",
      localDate: "2026-07-16",
      timezone: TZ,
      estimated: false,
      confidenceBps: 9400,
      why: { basis: "user said they skipped the gym yesterday", assumptions: [] },
      evidenceRefs: [],
      payload: { habitName: "Gym", status: "skipped", note: null },
    },
  ]),
  expected: { auto: [], pending: ["bd-habit"], note: "backdate always pending; accept writes localDate 2026-07-16 + grace-aware streak recompute" },
};

/** A minimal auto-eligible skill session used to exercise commit→undo. */
export const undoBatchFixture: CaptureFixture = {
  id: "undo-batch",
  draft: mkDraft("undo-batch", [
    {
      proposalId: "undo-skill",
      domain: "skills",
      kind: "skillSession",
      intent: "create",
      occurredAt: AT,
      localDate: DAY,
      timezone: TZ,
      estimated: false,
      confidenceBps: 9700,
      why: { basis: "explicit duration and a seeded skill", assumptions: [] },
      evidenceRefs: [],
      payload: { skillName: "System design", minutes: 60, note: null },
    },
  ]),
  expected: { auto: ["undo-skill"], pending: [], note: "seed skill 'System design'; commit then undoLatest restores rows + XP + minutes" },
};

/** An estimated meal derived from a photo (SAR-007 gate-3). Always pending — no meal
 *  row until the card is accepted. Fabricated test data (no vision pipeline). */
export const estimatedMealPhotoFixture: CaptureFixture = {
  id: "estimated-meal-photo",
  draft: mkDraft(
    "estimated-meal-photo",
    [
      {
        proposalId: "emp-meal",
        domain: "health",
        kind: "meal",
        intent: "create",
        occurredAt: AT,
        localDate: DAY,
        timezone: TZ,
        estimated: true,
        confidenceBps: 7400,
        why: { basis: "estimated from a meal photo", assumptions: ["portion size inferred from the image"] },
        evidenceRefs: [],
        payload: { kcal: 520, proteinGrams: 18, carbsGrams: 82, fatGrams: 14, items: [], note: null },
      },
    ],
    [],
    "photo",
  ),
  expected: { auto: [], pending: ["emp-meal"], note: "estimated photo meal → pending card; no meal row until accepted" },
};

/** The parse never produces a draft — the gateway fails; capture stays a retryable draft, zero rows. */
export const providerFailureFixture: CaptureFixture = {
  id: "provider-failure",
  draft: null,
  expectParseError: true,
  expected: { auto: [], pending: [], note: "gateway throw or invalid object ⇒ retryable draft, zero rows, zero outbox" },
};

export const allCaptureFixtures: CaptureFixture[] = [
  canonicalFixture,
  explicitLowConfidenceFixture,
  ambiguousSkillFixture,
  correctionExistingEntryFixture,
  backdateHabitFixture,
  undoBatchFixture,
  estimatedMealPhotoFixture,
  providerFailureFixture,
];
