import type { HabitsView } from "@/core/domains/habits";
import type { HealthView } from "@/core/domains/health";
import type { MoneyView } from "@/core/domains/money";
import type { SkillsView } from "@/core/domains/skills";
import type { TodayView } from "@/core/domains/today";
import { ArtFrame } from "@/components/art/ArtFrame";
import { todayHeaderArt } from "@/components/art/registry";

import { CoachLine } from "./CoachLine";
import { DomainSwitcher } from "./DomainSwitcher";
import { PlanSpine } from "./PlanSpine";
import { StatCluster } from "./StatCluster";
import { TodayHintRow } from "./TodayHintRow";

/** Composes the thin Today spine from the pure read-model. No logic here — the view is prebuilt. */
export function TodayBody({
  view,
  healthView,
  moneyView,
  habitsView,
  skillsView,
  initialDomain,
}: {
  view: TodayView;
  healthView: HealthView;
  moneyView: MoneyView;
  habitsView: HabitsView;
  skillsView: SkillsView;
  initialDomain?: string;
}) {
  const headerArt = todayHeaderArt(new Date().getHours());
  return (
    <div>
      <div className="px-4 pt-2">
        <ArtFrame artKey={headerArt} eager ratio="aspect-[3/1]" />
      </div>
      <StatCluster stat={view.stat} />
      <CoachLine text={view.coachLine} />
      {/* Day-1 only: the one-time mic hint (SAR-012 Phase G), dismissible + persisted. */}
      <TodayHintRow dayOne={view.stat.dayOfArc === 1} />
      <DomainSwitcher
        domains={view.domains}
        healthView={healthView}
        moneyView={moneyView}
        habitsView={habitsView}
        skillsView={skillsView}
        initialDomain={initialDomain}
      >
        <PlanSpine view={view} />
      </DomainSwitcher>
    </div>
  );
}
