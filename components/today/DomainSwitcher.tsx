"use client";

import { useState } from "react";

import { HabitsLens } from "@/components/lenses/HabitsLens";
import { HealthLens } from "@/components/lenses/HealthLens";
import { MoneyLens } from "@/components/lenses/MoneyLens";
import { Chip } from "@/components/ui/Chip";
import type { HabitsView } from "@/core/domains/habits";
import type { HealthView } from "@/core/domains/health";
import type { MoneyView } from "@/core/domains/money";
import type { TodayDomain } from "@/core/domains/today";

const LABELS: Record<TodayDomain, string> = {
  health: "Health",
  money: "Money",
  habits: "Habits",
  skills: "Skills",
};

/*
 * The domain switcher chip bar. "All" shows the plan spine (passed as children);
 * Health, Money, and Habits resolve to their lenses; Skills stays a LABELED
 * PLACEHOLDER until SAR-010 lands.
 */
export function DomainSwitcher({
  domains,
  healthView,
  moneyView,
  habitsView,
  children,
}: {
  domains: readonly TodayDomain[];
  healthView: HealthView;
  moneyView: MoneyView;
  habitsView: HabitsView;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<"all" | TodayDomain>("all");
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        <Chip active={selected === "all"} onClick={() => setSelected("all")}>
          All
        </Chip>
        {domains.map((domain) => (
          <Chip key={domain} active={selected === domain} onClick={() => setSelected(domain)}>
            {LABELS[domain]}
          </Chip>
        ))}
      </div>
      {selected === "all" ? (
        children
      ) : selected === "health" ? (
        <HealthLens view={healthView} />
      ) : selected === "money" ? (
        <MoneyLens view={moneyView} />
      ) : selected === "habits" ? (
        <HabitsLens view={habitsView} />
      ) : (
        <div className="px-4 pt-10 text-center">
          <p className="font-ui text-body text-ink-2">{LABELS[selected]} lens</p>
          <p className="mt-1 font-ui text-caption text-ink-3">
            The {LABELS[selected]} lens arrives in a later ticket.
          </p>
        </div>
      )}
    </div>
  );
}
