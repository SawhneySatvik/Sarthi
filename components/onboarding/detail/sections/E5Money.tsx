"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { formatPaise } from "@/core/domains/money";
import type { OnboardingDetailInput } from "@/core/onboarding";

import { SectionShell } from "../SectionShell";

/*
 * E5 — Money picture (§7). An optional monthly-income stepper (stored integer PAISE) + a
 * fixed-bills quick-add ("rent 15000"). Save resolves the `detail-money` gap and seeds typed
 * `recurring_rules` (income → a monthly credit; each bill → a monthly debit) — integer paise
 * only (invariant #2): rupees convert to paise at THIS boundary via ×100 (never a float).
 */
const INCOME_STEP = 5000; // ₹5,000 per tap

interface BillDraft {
  key: number;
  label: string;
  /** Rupees, as typed. Converts to integer paise (×100) only at save. */
  rupees: string;
}

function paiseFromRupees(rupees: number): number {
  return Math.round(rupees * 100);
}

export function E5Money({
  onSave,
  onSkip,
  saving,
}: {
  onSave: (payload: OnboardingDetailInput) => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const [incomeRupees, setIncomeRupees] = useState(0);
  const [bills, setBills] = useState<BillDraft[]>([]);
  const [nextKey, setNextKey] = useState(1);

  const addBill = () => {
    setBills((prev) => [...prev, { key: nextKey, label: "", rupees: "" }]);
    setNextKey((k) => k + 1);
  };
  const updateBill = (key: number, patch: Partial<BillDraft>) =>
    setBills((prev) => prev.map((bill) => (bill.key === key ? { ...bill, ...patch } : bill)));
  const removeBill = (key: number) => setBills((prev) => prev.filter((bill) => bill.key !== key));

  const save = () => {
    const cleanBills = bills
      .map((bill) => ({ label: bill.label.trim(), rupees: Math.max(0, Math.floor(Number(bill.rupees) || 0)) }))
      .filter((bill) => bill.label.length > 0 && bill.rupees > 0)
      .map((bill) => ({ label: bill.label, amountPaise: paiseFromRupees(bill.rupees) }));
    onSave({
      section: "money",
      monthlyIncomePaise: incomeRupees > 0 ? paiseFromRupees(incomeRupees) : null,
      bills: cleanBills,
    });
  };

  return (
    <SectionShell
      title="Your money picture."
      subline="Optional — it just makes budgets realistic. Nothing shared."
      saving={saving}
      onSkip={onSkip}
      onSave={save}
    >
      <div className="flex flex-col gap-8">
        <div>
          <p className="mb-2 font-ui text-caption uppercase tracking-wide text-ink-2">Monthly income</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Decrease income"
              onClick={() => setIncomeRupees((r) => Math.max(0, r - INCOME_STEP))}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-chip border border-line text-ink-2"
            >
              −
            </button>
            <span className="min-w-[6rem] text-center font-display text-title tabular-nums text-ink-1">
              {incomeRupees > 0 ? formatPaise(paiseFromRupees(incomeRupees)) : "—"}
            </span>
            <button
              type="button"
              aria-label="Increase income"
              onClick={() => setIncomeRupees((r) => r + INCOME_STEP)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-chip border border-line text-ink-2"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 font-ui text-caption uppercase tracking-wide text-ink-2">Fixed bills</p>
          <div className="flex flex-col gap-2">
            {bills.map((bill) => (
              <div key={bill.key} className="flex items-center gap-2">
                <input
                  value={bill.label}
                  onChange={(event) => updateBill(bill.key, { label: event.target.value })}
                  placeholder="rent"
                  aria-label="Bill name"
                  className="min-w-0 flex-1 rounded-input border border-line bg-canvas px-3 py-2.5 font-ui text-body text-ink-1 placeholder:text-ink-3 focus:outline-none"
                />
                <input
                  value={bill.rupees}
                  onChange={(event) => updateBill(bill.key, { rupees: event.target.value.replace(/[^0-9]/g, "") })}
                  inputMode="numeric"
                  placeholder="15000"
                  aria-label="Bill amount in rupees"
                  className="w-28 rounded-input border border-line bg-canvas px-3 py-2.5 text-right font-ui text-body tabular-nums text-ink-1 placeholder:text-ink-3 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={`Remove ${bill.label || "bill"}`}
                  onClick={() => removeBill(bill.key)}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-ink-3"
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addBill}
            className="mt-3 flex items-center gap-2 font-ui text-body text-ink-2"
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            Add a bill
          </button>
        </div>
      </div>
    </SectionShell>
  );
}
