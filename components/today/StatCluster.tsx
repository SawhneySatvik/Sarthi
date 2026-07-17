import { Flame, Gem } from "lucide-react";

import { StatPill } from "@/components/ui/StatPill";
import type { TodayStat } from "@/core/domains/today";

/** The slim amber stat cluster: Day N of M · streak · level (invariant #4 amber surface). */
export function StatCluster({ stat }: { stat: TodayStat }) {
  return (
    <div className="flex items-center gap-4 px-4 py-1">
      {stat.dayOfArc !== null && (
        <StatPill>
          Day {stat.dayOfArc}
          {stat.arcLength !== null ? ` of ${stat.arcLength}` : ""}
        </StatPill>
      )}
      <StatPill icon={<Flame size={13} strokeWidth={1.5} aria-hidden />}>{stat.streak}</StatPill>
      <StatPill icon={<Gem size={13} strokeWidth={1.5} aria-hidden />}>Lv {stat.level}</StatPill>
    </div>
  );
}
