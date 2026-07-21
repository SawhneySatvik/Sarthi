import type { HabitsView } from "@/core/domains/habits";
import type { HealthView } from "@/core/domains/health";
import type { MoneyView } from "@/core/domains/money";
import type { SkillsView } from "@/core/domains/skills";
import type { TodayView } from "@/core/domains/today";
import { ArtFrame } from "@/components/art/ArtFrame";
import { todayHeaderArt } from "@/components/art/registry";
import { SettingsSheet } from "@/components/settings/SettingsSheet";
import type { ProfileGapRecord, ProfileRecord } from "@/data/schema/contract";
import type { LlmProviderName } from "@/core/contracts";

import { InstallPrompt } from "@/components/pwa/InstallPrompt";

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
  profile,
  gaps,
  isDeveloperControlAllowed,
  llmProvider,
}: {
  view: TodayView;
  healthView: HealthView;
  moneyView: MoneyView;
  habitsView: HabitsView;
  skillsView: SkillsView;
  initialDomain?: string;
  profile: ProfileRecord | null;
  gaps: readonly ProfileGapRecord[];
  isDeveloperControlAllowed: boolean;
  llmProvider: LlmProviderName;
}) {
  const headerArt = todayHeaderArt(new Date().getHours());
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "short", day: "numeric" }).format(new Date());
  return (
    <div>
      <ArtFrame artKey={headerArt} eager ratio="aspect-[16/7]" className="rounded-none border-x-0 border-t-0">
        <div className="flex h-full flex-col justify-end p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-ui text-caption uppercase tracking-wide on-art-dim">{date}</p><h1 className="mt-1 font-display text-display on-art">Today</h1></div>{profile && <SettingsSheet profile={profile} gaps={gaps} identity={{ dayOfArc: view.stat.dayOfArc, level: view.stat.level }} isDeveloperControlAllowed={isDeveloperControlAllowed} llmProvider={llmProvider} />}</div>
          <StatCluster stat={view.stat} onArt />
        </div>
      </ArtFrame>
      <CoachLine text={view.coachLine} />
      {/* Day-1 only: the one-time mic hint (SAR-012 Phase G), dismissible + persisted. */}
      <TodayHintRow dayOne={view.stat.dayOfArc === 1} />
      {/* Dismissible PWA install affordance (FLOWS G) — inline flow, never overlays the header
          gear or the capture bar; self-hides unless installable / iOS Safari, and persists dismissal. */}
      <InstallPrompt />
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
