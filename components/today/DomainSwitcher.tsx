"use client";

import { type ReactNode, useState } from "react";

import { HabitsLens } from "@/components/lenses/HabitsLens";
import { HealthLens } from "@/components/lenses/HealthLens";
import { MoneyLens } from "@/components/lenses/MoneyLens";
import { SkillsLens } from "@/components/lenses/SkillsLens";
import { Chip } from "@/components/ui/Chip";
import type { HabitsView } from "@/core/domains/habits";
import type { HealthView } from "@/core/domains/health";
import type { MoneyView } from "@/core/domains/money";
import type { SkillsView } from "@/core/domains/skills";
import type { TodayDomain } from "@/core/domains/today";

const LABELS: Record<TodayDomain, string> = {
  health: "Health",
  money: "Money",
  habits: "Habits",
  skills: "Skills",
};

/*
 * The domain switcher chip bar. "All" shows the plan spine (passed as children); each of
 * the four domains resolves to its own lens — Skills (SAR-010) retires the last
 * placeholder, so all four chips now swap in a real lens body.
 */
export function DomainSwitcher({
  domains,
  healthView,
  moneyView,
  habitsView,
  skillsView,
  children,
  initialDomain,
  desktopContext,
}: {
  domains: readonly TodayDomain[];
  healthView: HealthView;
  moneyView: MoneyView;
  habitsView: HabitsView;
  skillsView: SkillsView;
  children: ReactNode;
  initialDomain?: string;
  desktopContext?: ReactNode;
}) {
  const safeInitial = initialDomain && domains.includes(initialDomain as TodayDomain) ? initialDomain as TodayDomain : "all";
  const [selected, setSelected] = useState<"all" | TodayDomain>(safeInitial);
  const isAll = selected === "all";
  return (
    <div className="lg:grid lg:grid-cols-3">
      {desktopContext && <aside className={`lg:col-start-3 lg:row-span-2 lg:row-start-1 ${isAll ? "" : "lg:hidden"}`}>{desktopContext}</aside>}
      <div className={`flex gap-2 overflow-x-auto px-4 py-3 lg:row-start-1 ${isAll ? "lg:col-span-2" : "lg:col-span-3"}`}>
        <Chip active={isAll} onClick={() => setSelected("all")}>
          All
        </Chip>
        {domains.map((domain) => (
          <Chip key={domain} active={selected === domain} onClick={() => setSelected(domain)}>
            {LABELS[domain]}
          </Chip>
        ))}
      </div>
      <div className={`lg:row-start-2 ${isAll ? "lg:col-span-2" : "lg:col-span-3"}`}>
        {isAll ? (
          children
        ) : selected === "health" ? (
          <HealthLens view={healthView} />
        ) : selected === "money" ? (
          <MoneyLens view={moneyView} />
        ) : selected === "habits" ? (
          <HabitsLens view={habitsView} />
        ) : (
          <SkillsLens view={skillsView} />
        )}
      </div>
    </div>
  );
}
