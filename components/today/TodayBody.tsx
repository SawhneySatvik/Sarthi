import type { HabitsView } from "@/core/domains/habits";
import type { HealthView } from "@/core/domains/health";
import type { MoneyView } from "@/core/domains/money";
import type { SkillsView } from "@/core/domains/skills";
import type { TodayView } from "@/core/domains/today";

import { CoachLine } from "./CoachLine";
import { DomainSwitcher } from "./DomainSwitcher";
import { PlanSpine } from "./PlanSpine";
import { StatCluster } from "./StatCluster";

/** Composes the thin Today spine from the pure read-model. No logic here — the view is prebuilt. */
export function TodayBody({
  view,
  healthView,
  moneyView,
  habitsView,
  skillsView,
}: {
  view: TodayView;
  healthView: HealthView;
  moneyView: MoneyView;
  habitsView: HabitsView;
  skillsView: SkillsView;
}) {
  return (
    <div>
      <StatCluster stat={view.stat} />
      <CoachLine text={view.coachLine} />
      <DomainSwitcher
        domains={view.domains}
        healthView={healthView}
        moneyView={moneyView}
        habitsView={habitsView}
        skillsView={skillsView}
      >
        <PlanSpine view={view} />
      </DomainSwitcher>
    </div>
  );
}
