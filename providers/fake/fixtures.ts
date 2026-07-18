/**
 * Versioned, inert fixture data for the local fake stack. These values are not
 * a capture schema and have no persistence or routing behavior.
 */
export const FAKE_FIXTURE_VERSION = "sarthi-fixtures-v1";

export const CANONICAL_CROSS_DOMAIN_DUMP =
  "Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design, woke at 5:10";

export const CANONICAL_CAPTURE_DRAFT_FIXTURE = {
  fixtureId: "canonical-cross-domain",
  fixtureVersion: FAKE_FIXTURE_VERSION,
  version: 1,
  draftId: "fake-canonical-cross-domain-v1",
  rawText: CANONICAL_CROSS_DOMAIN_DUMP,
  capturedAt: "2026-07-17T05:15:00.000Z",
  timezone: "Asia/Kolkata",
  source: "voice",
  transcriptConfidenceBps: 9800,
  evidenceRefs: [],
  proposals: [
    {
      proposalId: "fake-transaction-lunch-v1",
      domain: "money",
      kind: "transaction",
      intent: "create",
      occurredAt: "2026-07-17T05:15:00.000Z",
      localDate: "2026-07-17",
      timezone: "Asia/Kolkata",
      estimated: false,
      confidenceBps: 9800,
      why: { basis: "explicit spoken amount and meal purchase", assumptions: [] },
      evidenceRefs: [],
      payload: {
        direction: "expense",
        amountPaise: 34000,
        categoryName: "Food & dining",
        merchant: null,
        note: "Lunch",
      },
    },
    {
      proposalId: "fake-meal-lunch-v1",
      domain: "health",
      kind: "meal",
      intent: "create",
      occurredAt: "2026-07-17T05:15:00.000Z",
      localDate: "2026-07-17",
      timezone: "Asia/Kolkata",
      estimated: true,
      confidenceBps: 7600,
      why: { basis: "meal composition inferred from spoken food", assumptions: ["portion sizes are estimated"] },
      evidenceRefs: [],
      payload: {
        kcal: 520,
        proteinGrams: 18,
        carbsGrams: 82,
        fatGrams: 14,
        items: [
          { name: "roti", quantity: 2, unit: "piece" },
          { name: "dal", quantity: 1, unit: "bowl" },
        ],
        note: "Lunch",
      },
    },
    {
      proposalId: "fake-water-bottle-v1",
      domain: "health",
      kind: "water",
      intent: "create",
      occurredAt: "2026-07-17T05:15:00.000Z",
      localDate: "2026-07-17",
      timezone: "Asia/Kolkata",
      estimated: true,
      confidenceBps: 6000,
      why: {
        basis: "the spoken dump confirms a bottle of water but not its volume",
        assumptions: ["bottle volume is unknown and must be confirmed"],
      },
      evidenceRefs: [],
      payload: { millilitres: null },
    },
    {
      proposalId: "fake-skill-system-design-v1",
      domain: "skills",
      kind: "skillSession",
      intent: "create",
      occurredAt: "2026-07-17T05:15:00.000Z",
      localDate: "2026-07-17",
      timezone: "Asia/Kolkata",
      estimated: false,
      confidenceBps: 9700,
      why: { basis: "explicit spoken duration and skill", assumptions: [] },
      evidenceRefs: [],
      payload: { skillName: "System design", minutes: 90, note: null },
    },
    {
      proposalId: "fake-habit-wake-v1",
      domain: "habits",
      kind: "habitLog",
      intent: "create",
      occurredAt: "2026-07-17T05:10:00.000Z",
      localDate: "2026-07-17",
      timezone: "Asia/Kolkata",
      estimated: false,
      confidenceBps: 8600,
      why: { basis: "wake time is explicit but requires matching an existing habit", assumptions: [] },
      evidenceRefs: [],
      payload: { habitName: "Wake by 5:30 AM", status: "done", note: "Woke at 5:10" },
    },
  ],
  questions: [],
} as const;

// Conformed to `visionResultSchema` (SAR-011): `kind` discriminant + structured meal
// items + `note`. The schema strips the extra `fixtureId`/`fixtureVersion`/`source`/
// `estimated` keys (kept for the provider-shape tests); amounts/macros are unchanged.
export const ESTIMATED_MEAL_PHOTO_FIXTURE = {
  fixtureId: "estimated-meal-photo",
  fixtureVersion: FAKE_FIXTURE_VERSION,
  source: "photo",
  kind: "meal",
  estimated: true,
  confidenceBps: 7400,
  meal: {
    kcal: 520,
    proteinGrams: 18,
    carbsGrams: 82,
    fatGrams: 14,
    items: [
      { name: "roti", quantity: 2, unit: "piece" },
      { name: "dal", quantity: 1, unit: "bowl" },
    ],
    note: null,
  },
} as const;

// Conformed to `visionReceiptResultSchema` (SAR-011): `kind` + `confidenceBps` +
// receipt-level `merchant`/`purchasedLocalDate` + per-txn `note`. Integer paise only;
// 8600 bps is honest (not gamed under a threshold) — pending comes from the photo
// evidence rule, and ≥8000 keeps the batch Accept-all eligible (F5).
export const RECEIPT_BATCH_FIXTURE = {
  fixtureId: "receipt-batch",
  fixtureVersion: FAKE_FIXTURE_VERSION,
  source: "photo",
  kind: "receipt",
  estimated: false,
  requiresExplicitAcceptance: true,
  confidenceBps: 8600,
  merchant: null,
  purchasedLocalDate: null,
  transactions: [
    { amountPaise: 34000, direction: "expense", categoryName: "Food & dining", merchant: "Lunch counter", note: null },
    { amountPaise: 12000, direction: "expense", categoryName: "Transport", merchant: "Metro", note: null },
  ],
} as const;

export const CANNED_COACH_LINE_FIXTURE = {
  fixtureId: "canned-coach-line",
  fixtureVersion: FAKE_FIXTURE_VERSION,
  text: "Strong system-design block. Confirm the meal estimate and keep the streak moving.",
} as const;

export const DETERMINISTIC_BRIEF_FIXTURE = {
  fixtureId: "deterministic-brief",
  fixtureVersion: FAKE_FIXTURE_VERSION,
  scope: "daily",
  text: "You made a concrete start: money, water, and focused practice are all visible. Confirm only the estimates you trust.",
} as const;

export const CANONICAL_TRANSCRIPTION_FIXTURE = {
  fixtureId: "canonical-transcription",
  fixtureVersion: FAKE_FIXTURE_VERSION,
  text: CANONICAL_CROSS_DOMAIN_DUMP,
  confidenceBps: 9800,
  languageCode: "en-IN",
} as const;
