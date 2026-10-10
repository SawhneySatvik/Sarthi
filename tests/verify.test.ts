/**
 * tests/verify.test.ts — the server double-check (DEVDAY-0 A1/A2). Keyless, pure.
 *
 * A number an outside model supplied that is not literally in the user's words is
 * demoted to an estimate (→ pending card); literal numbers pass untouched; nothing
 * is ever promoted.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { numberAppearsInText, routeProposal, verifyAgainstText, type Proposal } from "../core/capture";

const TEXT = "Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design";
const NONE = new Set<string>();

const base = {
  proposalId: "p-1",
  intent: "create" as const,
  occurredAt: "2026-10-10T06:00:00.000Z",
  localDate: "2026-10-10",
  timezone: "Asia/Kolkata",
  estimated: false,
  confidenceBps: 10000,
  why: { basis: "ChatGPT tool call", assumptions: [] as string[] },
  evidenceRefs: [],
};

function transaction(amountPaise: number): Proposal {
  return {
    ...base,
    domain: "money",
    kind: "transaction",
    payload: { direction: "expense", amountPaise, categoryName: "Food & dining", merchant: null, note: "Lunch" },
  };
}

function meal(kcal: number, overrides: Partial<Proposal> = {}): Proposal {
  return {
    ...base,
    confidenceBps: 7000,
    domain: "health",
    kind: "meal",
    payload: { kcal, proteinGrams: null, carbsGrams: null, fatGrams: null, items: [], note: "2 rotis, dal" },
    ...overrides,
  } as Proposal;
}

function water(millilitres: number | null): Proposal {
  return { ...base, confidenceBps: 9500, domain: "health", kind: "water", payload: { millilitres } };
}

function skill(minutes: number): Proposal {
  return {
    ...base,
    domain: "skills",
    kind: "skillSession",
    payload: { skillName: "System design", minutes, note: null },
  };
}

test("transaction ₹340 stated in the words stays explicit", () => {
  const result = verifyAgainstText(transaction(34000), TEXT);
  assert.equal(result.proposal.estimated, false);
  assert.equal(result.proposal.confidenceBps, 10000);
  assert.deepEqual(result.demotedReasons, []);
  assert.equal(routeProposal(result.proposal, NONE).route, "auto");
});

test("rupee display forms ₹340, 340rs, 1,000 and 1.50 all match", () => {
  assert.equal(verifyAgainstText(transaction(34000), "paid ₹340 for cab").demotedReasons.length, 0);
  assert.equal(verifyAgainstText(transaction(34000), "paid 340rs for cab").demotedReasons.length, 0);
  assert.equal(verifyAgainstText(transaction(100000), "rent top-up 1,000").demotedReasons.length, 0);
  assert.equal(verifyAgainstText(transaction(150), "chai was 1.50").demotedReasons.length, 0);
  assert.equal(numberAppearsInText("1.5", "chai 1.50"), true);
  assert.equal(numberAppearsInText("1000", "spent 1,000"), true);
  assert.equal(numberAppearsInText("34", "spent 340"), false);
});

test("meal kcal 420 not in the words is demoted and routes pending", () => {
  const result = verifyAgainstText(meal(420), TEXT);
  assert.equal(result.proposal.estimated, true);
  assert.ok(result.proposal.confidenceBps <= 8999);
  assert.equal(result.demotedReasons.length, 1);
  assert.match(result.demotedReasons[0], /420 kcal/);
  assert.ok(result.proposal.why.assumptions.some((a) => a.includes("420 kcal")));
  assert.equal(routeProposal(result.proposal, NONE).route, "pending");
});

test("a high-confidence explicit-claimed guess is capped below the auto threshold", () => {
  const result = verifyAgainstText(meal(420, { estimated: false, confidenceBps: 10000 }), TEXT);
  assert.equal(result.proposal.confidenceBps, 8999);
  assert.equal(routeProposal(result.proposal, NONE).route, "pending");
});

test("skill session 90 min stated stays explicit and auto-routes", () => {
  const result = verifyAgainstText(skill(90), TEXT);
  assert.equal(result.proposal.estimated, false);
  assert.equal(result.proposal.confidenceBps, 10000);
  assert.equal(routeProposal(result.proposal, NONE).route, "auto");
});

test("water 500 ml guessed from 'a bottle' is demoted; null volume is left alone but still pends", () => {
  const guessed = verifyAgainstText(water(500), TEXT);
  assert.equal(guessed.proposal.estimated, true);
  assert.match(guessed.demotedReasons[0], /500 ml/);
  assert.equal(routeProposal(guessed.proposal, NONE).route, "pending");

  const unknown = verifyAgainstText(water(null), TEXT);
  assert.deepEqual(unknown.demotedReasons, []);
  assert.equal(unknown.proposal.estimated, false);
  assert.equal(routeProposal(unknown.proposal, NONE).route, "pending");
});

test("workout: stated minutes pass, guessed burnKcal is demoted; 1.5 kg keeps a 1500 g weigh-in", () => {
  const workout: Proposal = {
    ...base,
    domain: "health",
    kind: "workout",
    payload: { durationMinutes: 30, burnKcal: 250, exercises: [], note: null },
  };
  const result = verifyAgainstText(workout, "did a 30 min run");
  assert.equal(result.proposal.estimated, true);
  assert.equal(result.demotedReasons.length, 1);
  assert.match(result.demotedReasons[0], /250 kcal burned/);

  const weighIn: Proposal = { ...base, domain: "health", kind: "weighIn", payload: { weightGrams: 1500 } };
  const kept = verifyAgainstText(weighIn, "baby gained 1.5 kg");
  assert.deepEqual(kept.demotedReasons, []);
  assert.equal(kept.proposal.estimated, false);

  const heavy: Proposal = { ...base, domain: "health", kind: "weighIn", payload: { weightGrams: 72500 } };
  assert.deepEqual(verifyAgainstText(heavy, "weighed 72.5 kg today").demotedReasons, []);
  assert.match(verifyAgainstText(heavy, "weighed in today").demotedReasons[0], /72\.5 kg/);
});

test("never promotes: an estimated proposal whose number matches stays estimated", () => {
  const estimated = meal(420, { estimated: true, confidenceBps: 6000 });
  const result = verifyAgainstText(estimated, "had about 420 kcal of lunch");
  assert.equal(result.proposal.estimated, true);
  assert.equal(result.proposal.confidenceBps, 6000);
  assert.deepEqual(result.demotedReasons, []);
});

test("habit logs carry no number and pass through untouched", () => {
  const habit: Proposal = {
    ...base,
    domain: "habits",
    kind: "habitLog",
    payload: { habitName: "Meditate", status: "done", note: null },
  };
  const result = verifyAgainstText(habit, "meditated");
  assert.equal(result.proposal, habit);
  assert.deepEqual(result.demotedReasons, []);
});
