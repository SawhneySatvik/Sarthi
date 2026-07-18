"use client";

import { useState } from "react";

import { cn } from "@/app/lib/utils";
import type { MoneyBudgetBar, MoneyCategoryDrill, MoneyEntryRow, MoneyView } from "@/core/domains/money";
import { formatPaise } from "@/core/domains/money";

/*
 * The Money lens (SAR-008, D-042): a read-only ledger over the pure `MoneyView`.
 * Sections top→bottom (SCREEN-LENSES §1a): month headline · glass-box safe-to-spend
 * hero (click = the three-term math) · budget bars (tap = category drill) · recurring
 * shelf · day-grouped ledger obeying the shared row grammar (domain tick · title ·
 * category chip · tabular amount, credits in `--ok`, `~` on estimates). Drill = an
 * in-lens push/return; state resets when the domain switch unmounts the lens.
 *
 * Tokens only — honey `--dom-money`, statuses `--ok`/`--warn`/`--danger`, ink/lines.
 * No amber (`--energy`) anywhere: that hue is XP/streak/level only.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

const CHIP_CLASS = "shrink-0 rounded-chip border border-line px-2 py-0.5 font-ui text-caption text-ink-3";

/** In the main ledger the category chip drills; inside a drill it is inert (recategorize is deferred). */
function CategoryChip({ name, onDrill }: { name: string; onDrill?: () => void }) {
  if (onDrill) {
    return (
      <button type="button" onClick={onDrill} className={CHIP_CLASS}>
        {name}
      </button>
    );
  }
  return <span className={CHIP_CLASS}>{name}</span>;
}

function EntryRow({ row, onDrill }: { row: MoneyEntryRow; onDrill?: (key: string) => void }) {
  const credit = row.direction === "credit";
  return (
    <li className="flex items-center gap-2.5 rounded-card bg-card px-4 py-3">
      <span className="h-2 w-2 shrink-0 rounded-chip bg-money" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-ui text-body text-ink-1">{row.title}</span>
      <CategoryChip name={row.categoryName} onDrill={onDrill ? () => onDrill(row.categoryKey) : undefined} />
      {row.recurring && (
        <span className="shrink-0 font-ui text-caption text-ink-3" aria-label="recurring">
          ↻
        </span>
      )}
      <span className={cn("shrink-0 font-ui text-caption tabular-nums", credit ? "text-ok" : "text-ink-2")}>
        {row.estimated ? "~ " : ""}
        {credit ? "+" : "−"}
        {formatPaise(row.amountPaise)}
      </span>
    </li>
  );
}

function BudgetBarBody({ bar }: { bar: MoneyBudgetBar }) {
  const fill = bar.status === "over" ? "bg-danger" : bar.status === "warn" ? "bg-warn" : "bg-money";
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="font-ui text-body text-ink-1">{bar.categoryName}</span>
        <span className="font-ui text-caption tabular-nums text-ink-2">
          {formatPaise(bar.spentPaise)} / {formatPaise(bar.limitPaise)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-chip bg-raised">
          <div className={cn("h-full rounded-chip", fill)} style={{ width: `${bar.fillPercent}%` }} />
        </div>
        <span className="w-9 shrink-0 text-right font-ui text-caption tabular-nums text-ink-3">{bar.percentUsed}%</span>
      </div>
    </>
  );
}

function SafeToSpend({ view }: { view: MoneyView }) {
  const [open, setOpen] = useState(false);
  const s = view.safeToSpend;
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className="mt-4 w-full rounded-card border border-line bg-card px-4 py-4 text-left"
    >
      <p className="font-ui text-caption text-ink-3">Safe to spend</p>
      <p className="font-display text-display tabular-nums text-ink-1">{formatPaise(s.valuePaise)}</p>
      <p className="font-ui text-caption text-ink-3">
        {view.daysLeftInMonth > 0 ? `${view.daysLeftInMonth} days left this month` : "last day of the month"} · tap for the math
      </p>
      {open && (
        <dl className="mt-3 space-y-1 border-t border-line pt-3">
          <MathRow label="Balance so far" value={formatPaise(s.balancePaise)} />
          <MathRow label="Remaining budgeted" value={`−${formatPaise(s.remainingBudgetedPaise)}`} />
          <MathRow label="Upcoming recurring" value={`−${formatPaise(s.upcomingRecurringPaise)}`} />
          <MathRow label="Safe to spend" value={formatPaise(s.valuePaise)} strong />
        </dl>
      )}
    </button>
  );
}

function MathRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={cn("font-ui text-caption", strong ? "text-ink-1" : "text-ink-3")}>{label}</dt>
      <dd className={cn("font-ui text-caption tabular-nums", strong ? "text-ink-1" : "text-ink-2")}>{value}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="px-1 font-ui text-caption uppercase tracking-wide text-ink-3">{children}</h3>;
}

function DrillView({ drill, onBack }: { drill: MoneyCategoryDrill; onBack: () => void }) {
  return (
    <div className="px-4 pb-2">
      <button type="button" onClick={onBack} className="mt-2 flex items-center gap-1 font-ui text-caption text-ink-2">
        <span aria-hidden>‹</span> Back
      </button>
      <h2 className="mt-2 font-display text-title text-ink-1">{drill.name}</h2>
      <p className="font-ui text-caption tabular-nums text-ink-3">{formatPaise(drill.spentPaise)} spent this month</p>
      {drill.bar && (
        <div className="mt-3 rounded-card border border-line bg-card px-3 py-2.5">
          <BudgetBarBody bar={drill.bar} />
        </div>
      )}
      <ul className="mt-4 flex flex-col gap-1">
        {drill.rows.map((row) => (
          <EntryRow key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

export function MoneyLens({ view }: { view: MoneyView }) {
  const [drillKey, setDrillKey] = useState<string | null>(null);
  const drill = drillKey ? view.drills.find((d) => d.key === drillKey) ?? null : null;
  const openDrill = (key: string) => {
    if (view.drills.some((d) => d.key === key)) setDrillKey(key);
  };
  if (drill) return <DrillView drill={drill} onBack={() => setDrillKey(null)} />;

  return (
    <div className="px-4 pb-2">
      <header className="pt-1">
        <p className="font-ui text-caption uppercase tracking-wide text-money">Money</p>
        <p className="font-display text-display-xl tabular-nums text-ink-1">{formatPaise(view.headline.netPaise)}</p>
        <p className="font-ui text-caption text-ink-3">this month</p>
      </header>

      <SafeToSpend view={view} />

      <section className="mt-5">
        <SectionHeading>Budgets</SectionHeading>
        {view.budgets.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            {view.budgets.map((bar) => (
              <button
                key={bar.budgetId}
                type="button"
                onClick={() => openDrill(bar.categoryId)}
                className="w-full rounded-card border border-line bg-card px-3 py-2.5 text-left"
              >
                <BudgetBarBody bar={bar} />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-2">
            <span className="inline-flex rounded-chip border border-line px-3 py-1.5 font-ui text-caption text-ink-3">
              Set budgets
            </span>
          </div>
        )}
      </section>

      {view.recurringShelf.length > 0 && (
        <section className="mt-5">
          <SectionHeading>Recurring</SectionHeading>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {view.recurringShelf.map((chip) => (
              <div key={chip.id} className="shrink-0 rounded-card border border-line bg-card px-3 py-2">
                <div className="flex items-center gap-1">
                  <span
                    className={cn("font-ui text-caption", chip.direction === "credit" ? "text-ok" : "text-ink-3")}
                    aria-hidden
                  >
                    {chip.direction === "credit" ? "↑" : "↓"}
                  </span>
                  <span className="font-ui text-caption text-ink-1">{chip.label}</span>
                  {chip.postedThisMonth && (
                    <span className="font-ui text-caption text-ink-3" aria-label="posted this month">
                      ↻
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-ui text-caption tabular-nums text-ink-2">{formatPaise(chip.amountPaise)}</div>
                <div className="font-ui text-caption text-ink-3">{shortDate(chip.nextPostDate)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5">
        {view.days.length > 0 ? (
          view.days.map((day) => (
            <div key={day.localDate} className="mt-4 first:mt-0">
              <div className="flex items-baseline justify-between px-1">
                <SectionHeading>{day.label}</SectionHeading>
                <span className="font-ui text-caption tabular-nums text-ink-3">{formatPaise(day.netPaise)}</span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {day.rows.map((row) => (
                  <EntryRow key={row.id} row={row} onDrill={openDrill} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="mt-6 text-center font-ui text-body text-ink-3">Say a spend out loud — I&rsquo;ll file it.</p>
        )}
      </section>
    </div>
  );
}
