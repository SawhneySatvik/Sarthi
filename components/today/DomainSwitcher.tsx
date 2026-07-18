"use client";

import { useState } from "react";

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
}: {
  domains: readonly TodayDomain[];
  healthView: HealthView;
  moneyView: MoneyView;
  habitsView: HabitsView;
  skillsView: SkillsView;
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
        <SkillsLens view={skillsView} />
      )}
    </div>
  );
}
