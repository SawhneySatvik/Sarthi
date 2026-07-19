/**
 * tests/capture-deck.test.ts — the capture sheet's pure display/edit helpers
 * (SAR-006). Keyless. Guards the unit conversions (₹↔paise, kg↔grams) that a wrong
 * edit would turn into a wrong money/weight write, and the null-quantity display.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { displayProposal, formatPrimary, toStored } from "../components/capture/proposalText";
import type { Proposal } from "../core/capture/contract";

const base = {
  proposalId: "x",
  intent: "create" as const,
  occurredAt: "2026-07-18T05:15:00.000Z",
  localDate: "2026-07-18",
  timezone: "Asia/Kolkata",
  estimated: false,
  confidenceBps: 9500,
  why: { basis: "b", assumptions: [] as string[] },
  evidenceRefs: [] as never[],
};

const txn: Proposal = { ...base, domain: "money", kind: "transaction", payload: { direction: "expense", amountPaise: 34000, categoryName: "Food & dining", merchant: "Lunch", note: null } };
const skill: Proposal = { ...base, domain: "skills", kind: "skillSession", payload: { skillName: "System design", minutes: 90, note: null } };
const water: Proposal = { ...base, domain: "health", kind: "water", payload: { millilitres: null } };
const weigh: Proposal = { ...base, domain: "health", kind: "weighIn", payload: { weightGrams: 70500 } };

test("transaction displays ₹ from paise; edit round-trips to paise", () => {
  const view = displayProposal(txn);
  assert.equal(view.primary?.value, 340); // 34000 paise → ₹340
  assert.equal(formatPrimary(view.primary), "₹340");
  assert.equal(toStored(view.primary!, 340), 34000); // ₹→paise
  assert.equal(toStored(view.primary!, 500), 50000);
});

test("skill session shows minutes as-is", () => {
  const view = displayProposal(skill);
  assert.equal(view.primary?.value, 90);
  assert.equal(formatPrimary(view.primary), "90 min");
  assert.equal(toStored(view.primary!, 120), 120);
});

test("weigh-in displays kg from grams; edit round-trips to grams", () => {
  const view = displayProposal(weigh);
  assert.equal(view.primary?.value, 70.5); // 70500 g → 70.5 kg
  assert.equal(toStored(view.primary!, 71), 71000);
});

test("unknown quantity (null water) reads as 'unknown', never 0", () => {
  const view = displayProposal(water);
  assert.equal(view.primary?.value, null);
  assert.equal(formatPrimary(view.primary), "unknown");
});
