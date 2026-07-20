import { Flame, Gem } from "lucide-react";

import { StatPill } from "@/components/ui/StatPill";
import type { TodayStat } from "@/core/domains/today";

/*
 * The slim stat cluster: Day N of M · streak · level. The arc day-counter is a plan
 * position, NOT an earned reward — it renders in `--ink-2` (DESIGN §4: amber only
 * when earned). Streak/level are amber only once above their base (>0 / >1); zero/base
 * renders muted, so amber stays meaningful across the app.
 */
export function StatCluster({ stat, onArt = false }: { stat: TodayStat; onArt?: boolean }) {
  return (
    <div className="flex items-center gap-4 py-2">
      {stat.dayOfArc !== null && (
        <span className={`font-display text-caption tabular-nums ${onArt ? "on-art-dim" : "text-ink-2"}`}>
          Day {stat.dayOfArc}
          {stat.arcLength !== null ? ` of ${stat.arcLength}` : ""}
        </span>
      )}
      <StatPill tone={stat.streak > 0 ? "energy" : "muted"} onArt={onArt} icon={<Flame size={13} strokeWidth={1.5} aria-hidden />}>
        {stat.streak}
      </StatPill>
      <StatPill tone={stat.level > 1 ? "energy" : "muted"} onArt={onArt} icon={<Gem size={13} strokeWidth={1.5} aria-hidden />}>
        Lv {stat.level}
      </StatPill>
    </div>
  );
}
