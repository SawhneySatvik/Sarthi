/**
 * core/domains/money.ts — SAR-008 (D-042). The pure, framework-clean Money ledger
 * read-model: the month's typed money rows → a headline, the glass-box safe-to-spend
 * three-term sheet, per-category budget bars, a recurring shelf, a day-grouped ledger,
 * and per-category drills. Deterministic, INTEGER PAISE end-to-end (no money float —
 * the only division-to-string is `formatPaise`, via exact integer divmod). No
 * framework/DB import (invariant #9): type-only DTO edge, like `core/domains/health.ts`.
 *
 * All grouping/totals are in-memory reductions over equality-filtered repo reads —
 * the repos expose no range/aggregate ports (mirrors the `buildHealthView` posture).
 */
import type {
  BudgetRecord,
  Direction,
  MoneyCategoryRecord,
  RecurringRuleRecord,
  TransactionRecord,
} from "@/data/schema/contract";

const UNCATEGORIZED_KEY = "uncategorized";
const UNCATEGORIZED_NAME = "Uncategorized";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type MoneyBudgetStatus = "ok" | "warn" | "over";

export interface MoneyBudgetBar {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  limitPaise: number;
  spentPaise: number;
  /** floor(spent*100/limit) — integer percent (display, not money). */
  percentUsed: number;
  /** min(percentUsed, 100) — bar fill geometry. */
  fillPercent: number;
  status: MoneyBudgetStatus;
}

export interface MoneyRecurringChip {
  id: string;
  direction: Direction;
  amountPaise: number;
  label: string;
  nextPostDate: string;
  /** A transaction linked to this rule already landed in the month window. */
  postedThisMonth: boolean;
}

export interface MoneyEntryRow {
  id: string;
  title: string;
  /** categoryId, or 'uncategorized' for a null-category row (D-C). */
  categoryKey: string;
  categoryName: string;
  direction: Direction;
  /** Non-negative magnitude; the lens prefixes the sign by `direction`. */
  amountPaise: number;
  estimated: boolean;
  recurring: boolean;
}

export interface MoneyDayGroup {
  localDate: string;
  /** 'Today' | 'Yesterday' | 'DD Mon'. */
  label: string;
  netPaise: number;
  rows: MoneyEntryRow[];
}

export interface MoneyCategoryDrill {
  key: string;
  name: string;
  rows: MoneyEntryRow[];
  spentPaise: number;
  bar: MoneyBudgetBar | null;
}

export interface MoneySafeToSpend {
  valuePaise: number;
  balancePaise: number;
  remainingBudgetedPaise: number;
  upcomingRecurringPaise: number;
}

export interface MoneyHeadline {
  netPaise: number;
  creditPaise: number;
  debitPaise: number;
}

export interface MoneyView {
  localDate: string;
  monthStart: string;
  monthEnd: string;
  daysLeftInMonth: number;
  headline: MoneyHeadline;
  safeToSpend: MoneySafeToSpend;
  budgets: MoneyBudgetBar[];
  recurringShelf: MoneyRecurringChip[];
  days: MoneyDayGroup[];
  drills: MoneyCategoryDrill[];
}

export interface MoneyInput {
  localDate: string;
  transactions: readonly TransactionRecord[];
  categories: readonly MoneyCategoryRecord[];
  budgets: readonly BudgetRecord[];
  recurringRules: readonly RecurringRuleRecord[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Month window + days-left, from an ISO YYYY-MM-DD (lexicographic ISO compares are safe). */
function monthBounds(localDate: string): { monthStart: string; monthEnd: string; daysLeftInMonth: number } {
  const [year, month, day] = localDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    monthStart: `${year}-${pad2(month)}-01`,
    monthEnd: `${year}-${pad2(month)}-${pad2(lastDay)}`,
    daysLeftInMonth: Math.max(0, lastDay - day),
  };
}

function isoAddDays(localDate: string, delta: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === isoAddDays(today, -1)) return "Yesterday";
  const [, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** Integer sum of `amountPaise` over matching rows — never touches a float. */
function sumPaise(rows: readonly TransactionRecord[], match: (t: TransactionRecord) => boolean): number {
  let total = 0;
  for (const t of rows) if (match(t)) total += t.amountPaise;
  return total;
}

/** occurredAt desc, then id asc — a total order so grouped output is deterministic. */
function byRecency(a: TransactionRecord, b: TransactionRecord): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function categoryName(categoryId: string | null, nameById: ReadonlyMap<string, string>): string {
  if (categoryId === null) return UNCATEGORIZED_NAME;
  return nameById.get(categoryId) ?? UNCATEGORIZED_NAME;
}

function toRow(t: TransactionRecord, nameById: ReadonlyMap<string, string>): MoneyEntryRow {
  const name = categoryName(t.categoryId, nameById);
  const title = t.merchant ?? t.note ?? (t.categoryId !== null ? name : "Transaction");
  return {
    id: t.id,
    title,
    categoryKey: t.categoryId ?? UNCATEGORIZED_KEY,
    categoryName: name,
    direction: t.direction,
    amountPaise: t.amountPaise,
    estimated: t.estimated,
    recurring: t.recurringRuleId !== null,
  };
}

function toBudgetBar(budget: BudgetRecord, spentPaise: number, name: string): MoneyBudgetBar {
  const percentUsed = budget.limitPaise > 0 ? Math.floor((spentPaise * 100) / budget.limitPaise) : spentPaise > 0 ? 100 : 0;
  const status: MoneyBudgetStatus = spentPaise > budget.limitPaise ? "over" : percentUsed >= 90 ? "warn" : "ok";
  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    categoryName: name,
    limitPaise: budget.limitPaise,
    spentPaise,
    percentUsed,
    fillPercent: Math.min(percentUsed, 100),
    status,
  };
}

function recurringLabel(rule: RecurringRuleRecord, nameById: ReadonlyMap<string, string>): string {
  if (rule.merchant) return rule.merchant;
  if (rule.categoryId !== null) {
    const name = nameById.get(rule.categoryId);
    if (name) return name;
  }
  return rule.direction === "credit" ? "Income" : "Expense";
}

/**
 * Build the pure Money read-model. Balance is DERIVED (D-B / D-042) — there is no
 * account table; the headline is this-month net and safe-to-spend is the pinned
 * three-term formula (balance − remaining-budgeted − upcoming-recurring), with the
 * budget-overlap dedupe and debits-only recurring term. Every money value is integer paise.
 */
export function buildMoneyView(input: MoneyInput): MoneyView {
  const { localDate, transactions, categories, budgets, recurringRules } = input;
  const { monthStart, monthEnd, daysLeftInMonth } = monthBounds(localDate);
  const nameById = new Map(categories.map((c) => [c.id, c.name] as const));

  const monthTxns = transactions.filter((t) => t.localDate >= monthStart && t.localDate <= monthEnd);
  const toDateTxns = monthTxns.filter((t) => t.localDate <= localDate);

  // Headline — whole-month net.
  const creditPaise = sumPaise(monthTxns, (t) => t.direction === "credit");
  const debitPaise = sumPaise(monthTxns, (t) => t.direction === "debit");
  const headline: MoneyHeadline = { netPaise: creditPaise - debitPaise, creditPaise, debitPaise };

  // Balance so far — month rows up to and including today.
  const balancePaise =
    sumPaise(toDateTxns, (t) => t.direction === "credit") - sumPaise(toDateTxns, (t) => t.direction === "debit");

  // Budget bars — spent computed once over the budget's OWN period, then reused for
  // the remaining-budgeted term so the two never diverge (advisor lock).
  const activeBudgets = budgets.filter((b) => b.periodStart <= localDate && localDate <= b.periodEnd);
  const budgetBars: MoneyBudgetBar[] = activeBudgets
    .map((b) => {
      const spentPaise = sumPaise(
        transactions,
        (t) => t.direction === "debit" && t.categoryId === b.categoryId && t.localDate >= b.periodStart && t.localDate <= b.periodEnd,
      );
      return toBudgetBar(b, spentPaise, categoryName(b.categoryId, nameById));
    })
    .sort((a, b) => b.percentUsed - a.percentUsed || (a.categoryName < b.categoryName ? -1 : a.categoryName > b.categoryName ? 1 : 0) || (a.budgetId < b.budgetId ? -1 : 1));

  const remainingBudgetedPaise = budgetBars.reduce((sum, bar) => sum + Math.max(0, bar.limitPaise - bar.spentPaise), 0);
  const budgetedCategoryIds = new Set(activeBudgets.map((b) => b.categoryId));

  // Upcoming recurring — non-paused debits due before month end whose category is NOT
  // already covered by an active budget (dedupe: no double subtraction). Income never
  // pre-counts (ask-don't-invent).
  const activeRules = recurringRules.filter((r) => !r.isPaused);
  const upcomingRecurringPaise = activeRules.reduce((sum, r) => {
    const due = r.direction === "debit" && r.nextPostDate > localDate && r.nextPostDate <= monthEnd;
    const budgeted = r.categoryId !== null && budgetedCategoryIds.has(r.categoryId);
    return due && !budgeted ? sum + r.amountPaise : sum;
  }, 0);

  const safeToSpend: MoneySafeToSpend = {
    valuePaise: balancePaise - remainingBudgetedPaise - upcomingRecurringPaise,
    balancePaise,
    remainingBudgetedPaise,
    upcomingRecurringPaise,
  };

  // Recurring shelf — every non-paused rule; posted-this-month drives the ↻ marker.
  const postedRuleIds = new Set(
    monthTxns.filter((t) => t.recurringRuleId !== null).map((t) => t.recurringRuleId as string),
  );
  const recurringShelf: MoneyRecurringChip[] = activeRules
    .map((r) => ({
      id: r.id,
      direction: r.direction,
      amountPaise: r.amountPaise,
      label: recurringLabel(r, nameById),
      nextPostDate: r.nextPostDate,
      postedThisMonth: postedRuleIds.has(r.id),
    }))
    .sort((a, b) => (a.nextPostDate < b.nextPostDate ? -1 : a.nextPostDate > b.nextPostDate ? 1 : a.label < b.label ? -1 : a.label > b.label ? 1 : a.id < b.id ? -1 : 1));

  // Day-grouped ledger — month window, desc; empty days never render (they collapse).
  const dayMap = new Map<string, TransactionRecord[]>();
  for (const t of monthTxns) {
    const bucket = dayMap.get(t.localDate);
    if (bucket) bucket.push(t);
    else dayMap.set(t.localDate, [t]);
  }
  const days: MoneyDayGroup[] = [...dayMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, txns]) => ({
      localDate: date,
      label: dayLabel(date, localDate),
      netPaise: sumPaise(txns, (t) => t.direction === "credit") - sumPaise(txns, (t) => t.direction === "debit"),
      rows: txns.slice().sort(byRecency).map((t) => toRow(t, nameById)),
    }));

  // Category drills — one per category with month activity, plus the uncategorized bucket.
  const drillMap = new Map<string, TransactionRecord[]>();
  for (const t of monthTxns) {
    const key = t.categoryId ?? UNCATEGORIZED_KEY;
    const bucket = drillMap.get(key);
    if (bucket) bucket.push(t);
    else drillMap.set(key, [t]);
  }
  const barByCategory = new Map(budgetBars.map((b) => [b.categoryId, b] as const));
  // Every ledger categoryKey AND every budgeted category gets a drill, so both the
  // category-chip tap and the budget-bar tap always land on a real drill (empty rows
  // render the §1b empty-drill state rather than a dead tap).
  const drillKeys = new Set<string>([...drillMap.keys(), ...budgetBars.map((b) => b.categoryId)]);
  const drills: MoneyCategoryDrill[] = [...drillKeys]
    .map((key) => {
      const txns = drillMap.get(key) ?? [];
      return {
        key,
        name: key === UNCATEGORIZED_KEY ? UNCATEGORIZED_NAME : nameById.get(key) ?? UNCATEGORIZED_NAME,
        rows: txns.slice().sort(byRecency).map((t) => toRow(t, nameById)),
        spentPaise: sumPaise(txns, (t) => t.direction === "debit"),
        bar: key === UNCATEGORIZED_KEY ? null : barByCategory.get(key) ?? null,
      };
    })
    .sort((a, b) => b.spentPaise - a.spentPaise || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.key < b.key ? -1 : 1));

  return {
    localDate,
    monthStart,
    monthEnd,
    daysLeftInMonth,
    headline,
    safeToSpend,
    budgets: budgetBars,
    recurringShelf,
    days,
    drills,
  };
}

/**
 * Render integer paise as a rupee string via EXACT integer divmod (no money float):
 * paise part is `abs % 100`, rupees are `(abs − paisePart) / 100` (always divisible,
 * so no rounding), grouped en-IN (lakh/crore) by hand — ICU-independent, deterministic.
 * Paise shown only when non-zero. Negative values render with a leading minus.
 */
export function formatPaise(paise: number): string {
  const negative = paise < 0;
  const abs = negative ? -paise : paise;
  const paisePart = abs % 100;
  const rupees = (abs - paisePart) / 100;
  const grouped = groupIndian(rupees);
  const body = paisePart > 0 ? `${grouped}.${pad2(paisePart)}` : grouped;
  return `${negative ? "−" : ""}₹${body}`;
}

/** Indian digit grouping: rightmost 3, then pairs (e.g. 812345 → "8,12,345"). */
function groupIndian(rupees: number): string {
  const s = String(rupees);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}
