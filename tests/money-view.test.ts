/**
 * tests/money-view.test.ts — the pure Money ledger read-model (SAR-008, D-042). Keyless.
 * Proves the derived-balance safe-to-spend formula (balance − remaining-budgeted −
 * upcoming-recurring) with the budget-overlap dedupe + debits-only recurring term, the
 * uncategorized bucket (nullable categoryId), budget-bar thresholds/floor, day grouping
 * + labels + order, negative safe-to-spend, `formatPaise` integer divmod, and that every
 * number in the view is an integer (no money float anywhere).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildMoneyView, formatPaise } from "../core/domains/money";
import type { BudgetRecord, MoneyCategoryRecord, RecurringRuleRecord, TransactionRecord } from "../data/schema/contract";

const LOCAL_DATE = "2026-07-18";
const BASE = { userId: "local-dev", createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:00.000Z", deletedAt: null };

function txn(over: Partial<TransactionRecord> & { id: string }): TransactionRecord {
  return {
    ...BASE,
    occurredAt: "2026-07-18T12:00:00.000Z",
    localDate: LOCAL_DATE,
    timezone: "UTC",
    direction: "debit",
    amountPaise: 0,
    categoryId: null,
    merchant: null,
    note: null,
    source: "capture",
    confidenceBps: 9000,
    estimated: false,
    evidenceId: null,
    recurringRuleId: null,
    ...over,
  } as TransactionRecord;
}
function cat(id: string, name: string, kind: MoneyCategoryRecord["kind"] = "expense"): MoneyCategoryRecord {
  return { ...BASE, id, name, kind, colorKey: null, isSystem: false } as MoneyCategoryRecord;
}
function budget(over: Partial<BudgetRecord> & { id: string; categoryId: string }): BudgetRecord {
  return { ...BASE, periodStart: "2026-07-01", periodEnd: "2026-07-31", limitPaise: 0, ...over } as BudgetRecord;
}
function rule(over: Partial<RecurringRuleRecord> & { id: string }): RecurringRuleRecord {
  return { ...BASE, direction: "debit", amountPaise: 0, categoryId: null, merchant: null, cadence: "monthly", nextPostDate: "2026-08-01", isPaused: false, ...over } as RecurringRuleRecord;
}

/** The reference fixture — the numbers hand-checked in the plan (safe-to-spend = 8,463,100). */
function fixture() {
  const categories = [cat("cat-food", "Food & dining"), cat("cat-transport", "Transport"), cat("cat-rent", "Rent"), cat("cat-salary", "Salary", "income")];
  const transactions = [
    txn({ id: "t-salary", direction: "credit", amountPaise: 12000000, categoryId: "cat-salary", localDate: "2026-07-01", recurringRuleId: "rule-salary" }),
    txn({ id: "t-food-1", amountPaise: 34000, categoryId: "cat-food", merchant: "Lunch" }),
    txn({ id: "t-food-2", amountPaise: 52000, categoryId: "cat-food", merchant: "Swiggy", estimated: true }),
    txn({ id: "t-food-3", amountPaise: 538000, categoryId: "cat-food", merchant: "BigBasket", localDate: "2026-07-17" }),
    txn({ id: "t-transport", amountPaise: 190000, categoryId: "cat-transport", merchant: "Uber" }),
    txn({ id: "t-uncat", amountPaise: 25000, categoryId: null }),
  ];
  const budgets = [
    budget({ id: "b-food", categoryId: "cat-food", limitPaise: 800000 }),
    budget({ id: "b-transport", categoryId: "cat-transport", limitPaise: 200000 }),
  ];
  const recurringRules = [
    rule({ id: "rule-rent", amountPaise: 2500000, categoryId: "cat-rent", merchant: "Rent", nextPostDate: "2026-07-21" }),
    rule({ id: "rule-spotify", amountPaise: 11900, merchant: "Spotify", nextPostDate: "2026-07-23" }),
    rule({ id: "rule-food-auto", amountPaise: 100000, categoryId: "cat-food", merchant: "Meal plan", nextPostDate: "2026-07-25" }),
    rule({ id: "rule-salary", direction: "credit", amountPaise: 12000000, categoryId: "cat-salary", merchant: "Salary", nextPostDate: "2026-08-01" }),
  ];
  return { localDate: LOCAL_DATE, transactions, categories, budgets, recurringRules };
}

test("safe-to-spend = balance − remaining-budgeted − upcoming-recurring (dedupe + debits-only)", () => {
  const view = buildMoneyView(fixture());
  // headline: whole-month net = 12,000,000 credit − 839,000 debit
  assert.equal(view.headline.creditPaise, 12000000);
  assert.equal(view.headline.debitPaise, 839000);
  assert.equal(view.headline.netPaise, 11161000);
  // balance so far = credits − debits (≤ today)
  assert.equal(view.safeToSpend.balancePaise, 11161000);
  // remaining budgeted = (800000−624000) + (200000−190000)
  assert.equal(view.safeToSpend.remainingBudgetedPaise, 186000);
  // upcoming recurring = rent 2,500,000 + spotify 11,900; salary (credit) excluded,
  // food-auto (category already budgeted) DEDUPED — proves both rules of D-B.
  assert.equal(view.safeToSpend.upcomingRecurringPaise, 2511900);
  assert.equal(view.safeToSpend.valuePaise, 8463100);
});

test("food-auto is only deduped because Food has an active budget", () => {
  // Drop the Food budget → the food-auto rule is no longer covered → it is now counted.
  const base = fixture();
  const view = buildMoneyView({ ...base, budgets: base.budgets.filter((b) => b.id !== "b-food") });
  assert.equal(view.safeToSpend.upcomingRecurringPaise, 2511900 + 100000);
});

test("nullable categoryId yields an Uncategorized bucket (row + drill, never a budget bar)", () => {
  const view = buildMoneyView(fixture());
  const row = view.days.flatMap((d) => d.rows).find((r) => r.id === "t-uncat");
  assert.ok(row);
  assert.equal(row.categoryKey, "uncategorized");
  assert.equal(row.categoryName, "Uncategorized");
  assert.equal(row.title, "Transaction"); // no merchant/note falls back, never invents a category
  const drill = view.drills.find((d) => d.key === "uncategorized");
  assert.ok(drill);
  assert.equal(drill.name, "Uncategorized");
  assert.equal(drill.spentPaise, 25000);
  assert.equal(drill.bar, null);
});

test("budget-bar status thresholds: over / warn / ok with integer floor + clamped fill", () => {
  const categories = [cat("c-over", "Over"), cat("c-warn", "Warn"), cat("c-ok", "Ok"), cat("c-floor", "Floor")];
  const transactions = [
    txn({ id: "x1", amountPaise: 130000, categoryId: "c-over" }),
    txn({ id: "x2", amountPaise: 95000, categoryId: "c-warn" }),
    txn({ id: "x3", amountPaise: 50000, categoryId: "c-ok" }),
    txn({ id: "x4", amountPaise: 100000, categoryId: "c-floor" }),
  ];
  const budgets = [
    budget({ id: "bo", categoryId: "c-over", limitPaise: 100000 }),
    budget({ id: "bw", categoryId: "c-warn", limitPaise: 100000 }),
    budget({ id: "bk", categoryId: "c-ok", limitPaise: 100000 }),
    budget({ id: "bf", categoryId: "c-floor", limitPaise: 300000 }),
  ];
  const view = buildMoneyView({ localDate: LOCAL_DATE, transactions, categories, budgets, recurringRules: [] });
  const byId = Object.fromEntries(view.budgets.map((b) => [b.budgetId, b]));
  assert.equal(byId.bo.status, "over");
  assert.equal(byId.bo.percentUsed, 130);
  assert.equal(byId.bo.fillPercent, 100); // clamped
  assert.equal(byId.bw.status, "warn");
  assert.equal(byId.bw.percentUsed, 95);
  assert.equal(byId.bk.status, "ok");
  assert.equal(byId.bf.percentUsed, 33); // floor(100000*100/300000)
  // percentUsed-desc order surfaces the worst bar first
  assert.equal(view.budgets[0].budgetId, "bo");
});

test("ledger groups by day, desc, with Today/Yesterday/date labels and per-day net", () => {
  const transactions = [
    txn({ id: "d1a", amountPaise: 34000, occurredAt: "2026-07-18T08:00:00.000Z" }),
    txn({ id: "d1b", direction: "credit", amountPaise: 100000, occurredAt: "2026-07-18T20:00:00.000Z" }),
    txn({ id: "d2", amountPaise: 50000, localDate: "2026-07-17" }),
    txn({ id: "d3", amountPaise: 20000, localDate: "2026-07-10" }),
  ];
  const view = buildMoneyView({ localDate: LOCAL_DATE, transactions, categories: [], budgets: [], recurringRules: [] });
  assert.deepEqual(view.days.map((d) => d.localDate), ["2026-07-18", "2026-07-17", "2026-07-10"]);
  assert.deepEqual(view.days.map((d) => d.label), ["Today", "Yesterday", "10 Jul"]);
  assert.equal(view.days[0].netPaise, 66000); // 100000 credit − 34000 debit
  assert.equal(view.days[1].netPaise, -50000);
  // within a day, most recent occurredAt first
  assert.deepEqual(view.days[0].rows.map((r) => r.id), ["d1b", "d1a"]);
});

test("only current-month rows enter the ledger, headline, and drills", () => {
  const transactions = [
    txn({ id: "in", amountPaise: 10000, localDate: "2026-07-05" }),
    txn({ id: "prev-month", amountPaise: 99999, localDate: "2026-06-30" }),
    txn({ id: "next-month", amountPaise: 88888, localDate: "2026-08-01" }),
  ];
  const view = buildMoneyView({ localDate: LOCAL_DATE, transactions, categories: [], budgets: [], recurringRules: [] });
  assert.equal(view.monthStart, "2026-07-01");
  assert.equal(view.monthEnd, "2026-07-31");
  assert.equal(view.headline.debitPaise, 10000);
  assert.equal(view.days.flatMap((d) => d.rows).length, 1);
});

test("recurring shelf lists every non-paused rule, marks posted-this-month, ordered by next date", () => {
  const view = buildMoneyView(fixture());
  assert.deepEqual(view.recurringShelf.map((c) => c.id), ["rule-rent", "rule-spotify", "rule-food-auto", "rule-salary"]);
  const bySalary = view.recurringShelf.find((c) => c.id === "rule-salary");
  assert.equal(bySalary?.postedThisMonth, true); // a txn links back to it this month
  assert.equal(view.recurringShelf.find((c) => c.id === "rule-rent")?.postedThisMonth, false);
});

test("paused recurring rules are excluded from shelf and upcoming term", () => {
  const base = fixture();
  const withPaused = base.recurringRules.map((r) => (r.id === "rule-rent" ? { ...r, isPaused: true } : r));
  const view = buildMoneyView({ ...base, recurringRules: withPaused });
  assert.equal(view.recurringShelf.some((c) => c.id === "rule-rent"), false);
  assert.equal(view.safeToSpend.upcomingRecurringPaise, 11900); // rent dropped, spotify remains
});

test("safe-to-spend renders honestly negative when obligations exceed balance", () => {
  const transactions = [txn({ id: "spend", amountPaise: 500000 })];
  const recurringRules = [rule({ id: "big", amountPaise: 2000000, nextPostDate: "2026-07-25" })];
  const view = buildMoneyView({ localDate: LOCAL_DATE, transactions, categories: [], budgets: [], recurringRules });
  assert.equal(view.safeToSpend.balancePaise, -500000);
  assert.equal(view.safeToSpend.valuePaise, -2500000);
  assert.equal(formatPaise(view.safeToSpend.valuePaise), "−₹25,000");
});

test("every ledger row categoryKey resolves to a real drill (no dead chip tap)", () => {
  const view = buildMoneyView(fixture());
  const keys = new Set(view.drills.map((d) => d.key));
  for (const row of view.days.flatMap((d) => d.rows)) {
    assert.ok(keys.has(row.categoryKey), `no drill for categoryKey ${row.categoryKey}`);
  }
  assert.ok(keys.has("uncategorized"), "the Uncategorized bucket must be reachable");
});

test("a budgeted category with no month activity still yields a drillable (empty) entry", () => {
  const categories = [cat("c-empty", "Utilities")];
  const budgets = [budget({ id: "b-empty", categoryId: "c-empty", limitPaise: 500000 })];
  const view = buildMoneyView({ localDate: LOCAL_DATE, transactions: [], categories, budgets, recurringRules: [] });
  const drill = view.drills.find((d) => d.key === "c-empty");
  assert.ok(drill, "a budgeted category must have a drill so the bar tap lands");
  assert.equal(drill.rows.length, 0);
  assert.equal(drill.spentPaise, 0);
  assert.ok(drill.bar, "the empty drill still carries its budget bar");
});

test("formatPaise: exact integer divmod, en-IN grouping, paise only when non-zero", () => {
  assert.equal(formatPaise(0), "₹0");
  assert.equal(formatPaise(100), "₹1");
  assert.equal(formatPaise(99), "₹0.99");
  assert.equal(formatPaise(34000), "₹340");
  assert.equal(formatPaise(34050), "₹340.50");
  assert.equal(formatPaise(4125000), "₹41,250");
  assert.equal(formatPaise(81234567), "₹8,12,345.67");
  assert.equal(formatPaise(-34000), "−₹340");
});

test("every number in the view is an integer (no money float anywhere)", () => {
  const view = buildMoneyView(fixture());
  const walk = (node: unknown, path: string): void => {
    if (typeof node === "number") {
      assert.ok(Number.isInteger(node), `${path} is not an integer: ${node}`);
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
    }
  };
  walk(view, "view");
});
