import { ArtFrame } from "@/components/art/ArtFrame";

import { Reveal } from "./Reveal";

/*
 * Coach — the glass-box promise. A coach that reacts, briefs, reflects, and adapts the
 * plan in the open: before -> after -> reason, revertible. Left = the weekly-band scene,
 * right = a concrete adaptation shown as three plain rows (no gradient chrome).
 */
const STEPS: { label: string; text: string }[] = [
  { label: "Before", text: "3 strength sessions this week" },
  { label: "After", text: "2 sessions + one long walk" },
  { label: "Reason", text: "Two late work nights — protect recovery, keep the streak alive." },
];

export function Coach() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8 sm:py-32">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <ArtFrame artKey="coach.week_band" ratio="aspect-[4/3] w-full" />
        </Reveal>

        <Reveal delay={0.05}>
          <div className="max-w-lg">
            <h2 className="font-coach text-display-xl tracking-tight text-ink-1">A coach that shows its work.</h2>
            <p className="mt-4 font-ui text-body leading-relaxed text-ink-2">
              Sarthi reacts to each capture, briefs you every morning, and reflects each week. When it
              changes your plan, it shows the whole reasoning — and every change is one tap to revert.
            </p>

            <div className="mt-8 overflow-hidden rounded-card border border-line bg-raised">
              {STEPS.map((step, i) => (
                <div
                  key={step.label}
                  className={`flex gap-4 p-4 sm:p-5 ${i > 0 ? "border-t border-line" : ""}`}
                >
                  <span className="w-16 shrink-0 font-ui text-caption font-medium uppercase tracking-wide text-ink-3">
                    {step.label}
                  </span>
                  <span
                    className={`font-ui text-body ${step.label === "Reason" ? "font-coach text-ink-1" : "text-ink-1"}`}
                  >
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
