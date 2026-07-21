import { Reveal } from "./Reveal";

/*
 * Moat — "one sentence becomes four". The canonical messy sentence resolves into four
 * filed entries, one per domain. This is the product's whole thesis in one glance.
 * The ONE amber (--energy) on the entire landing is the earned "+18 XP" chip on the
 * Health card (invariant #4 reserves amber for earned XP). Domain hues come from the
 * token layer via inline var() — the established app pattern (see lenses/*).
 */
type Entry = {
  domain: string;
  hue: string;
  value: string;
  label: string;
  status: "Filed" | "Confirm";
  xp?: string;
};

const ENTRIES: Entry[] = [
  { domain: "Money", hue: "var(--dom-money)", value: "−₹340", label: "Lunch", status: "Filed" },
  { domain: "Health", hue: "var(--dom-health)", value: "Meal + water", label: "estimated macros", status: "Confirm", xp: "+18 XP" },
  { domain: "Skills", hue: "var(--dom-skills)", value: "90 min", label: "System design", status: "Filed" },
  { domain: "Habits", hue: "var(--dom-habits)", value: "Woke 5:10", label: "Morning", status: "Filed" },
];

function EntryCard({ entry }: { entry: Entry }) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-raised p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-ui text-caption font-medium uppercase tracking-wide text-ink-2">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.hue }} />
          {entry.domain}
        </span>
        {entry.status === "Filed" ? (
          <span className="font-ui text-caption text-ink-3">Filed</span>
        ) : (
          <span className="rounded-chip border border-line px-2 py-0.5 font-ui text-caption font-medium text-ink-1">
            Confirm
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-display text-ink-1 tabular-nums">{entry.value}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="font-ui text-caption text-ink-2">{entry.label}</p>
        {entry.xp ? (
          <span
            className="rounded-chip px-2 py-0.5 font-ui text-caption font-semibold"
            style={{ color: "var(--energy)", backgroundColor: "color-mix(in oklab, var(--energy) 14%, transparent)" }}
          >
            {entry.xp}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Moat() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8 sm:py-32">
      <Reveal className="max-w-2xl">
        <p className="font-ui text-caption font-medium uppercase tracking-[0.14em] text-ink-3">The moat</p>
        <h2 className="mt-3 font-coach text-display-xl tracking-tight text-ink-1">One sentence becomes four.</h2>
        <p className="mt-4 font-ui text-body leading-relaxed text-ink-2">
          One capture pipeline routes a single utterance into four typed stores at once. Explicit values
          file silently; anything estimated surfaces as a swipe card — you confirm before it is written.
        </p>
      </Reveal>

      <Reveal className="mt-10" delay={0.05}>
        <p className="font-coach text-display text-ink-1">
          &ldquo;spent ₹340 on lunch, 90 min of system design, woke at 5:10&rdquo;
        </p>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ENTRIES.map((entry, i) => (
          <Reveal key={entry.domain} delay={0.05 * (i + 1)}>
            <EntryCard entry={entry} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
