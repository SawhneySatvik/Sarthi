import type { HealthView } from "@/core/domains/health";
import type { TodayView } from "@/core/domains/today";

import { CoachLine } from "./CoachLine";
import { DomainSwitcher } from "./DomainSwitcher";
import { PlanSpine } from "./PlanSpine";
import { StatCluster } from "./StatCluster";

/** Composes the thin Today spine from the pure read-model. No logic here — the view is prebuilt. */
export function TodayBody({ view, healthView }: { view: TodayView; healthView: HealthView }) {
  return (
    <div>
      <StatCluster stat={view.stat} />
      <CoachLine text={view.coachLine} />
      <DomainSwitcher domains={view.domains} healthView={healthView}>
        <PlanSpine view={view} />
      </DomainSwitcher>
    </div>
  );
}
