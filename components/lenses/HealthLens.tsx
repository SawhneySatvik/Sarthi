import type { HealthRing, HealthView } from "@/core/domains/health";
import { ArtFrame } from "@/components/art/ArtFrame";

/*
 * The Health lens (SAR-006, D-J): three glanceable rings (energy / water / protein)
 * over the pure read-model, plus the day's Health entry rows. Row grammar matches
 * SCREEN-LENSES §0 (domain tick · content · meta · estimated chip). The satisfied-by
 * row is a Habits-lens element (SAR-009) — SAR-006 only produces its writes.
 */
const RING_STROKE: Record<HealthRing["key"], string> = {
  energy: "var(--dom-health)",
  water: "var(--health-water)",
  protein: "var(--health-protein)",
};

function Ring({ ring }: { ring: HealthRing }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80" role="img" aria-label={`${ring.label}: ${ring.value} of ${ring.target} ${ring.unit}`}>
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={RING_STROKE[ring.key]}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circumference * ring.fraction} ${circumference}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <span className="font-display text-caption tabular-nums text-ink-1">
        {ring.value}
        <span className="text-ink-3">/{ring.target}</span>
      </span>
      <span className="font-ui text-caption text-ink-3">{ring.label}</span>
    </div>
  );
}

export function HealthLens({ view }: { view: HealthView }) {
  return (
    <div className="px-4">
      <ArtFrame artKey="health.water" ratio="h-20" className="mb-3"><p className="flex h-full items-end p-3 font-display text-title on-art">Health</p></ArtFrame>
      <div className="lg:grid lg:grid-cols-3 lg:gap-4">
        <div>
          <div className="flex items-center justify-around rounded-card border border-line bg-card py-5">
            {view.rings.map((ring) => (
              <Ring key={ring.key} ring={ring} />
            ))}
          </div>
          {view.energyOut > 0 && (
            <p className="mt-2 text-center font-ui text-caption text-ink-3">
              <span className="tabular-nums">{view.energyOut}</span> kcal burned today
            </p>
          )}
        </div>
        <div className="lg:col-span-2">
          {view.entries.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-1 lg:mt-0">
              {view.entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 rounded-card bg-card px-4 py-3">
                  <span className="h-2 w-2 shrink-0 rounded-chip bg-health" aria-hidden />
                  <span className="flex-1 truncate font-ui text-body text-ink-1">{entry.title}</span>
                  <span className="shrink-0 font-ui text-caption tabular-nums text-ink-2">
                    {entry.estimated ? "~ " : ""}
                    {entry.meta}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-center font-ui text-body text-ink-3 lg:mt-0">Nothing logged for Health yet today.</p>
          )}
        </div>
      </div>
    </div>
  );
}
