import { ArtFrame } from "@/components/art/ArtFrame";
import type { ArtKey } from "@/components/art/registry";

import { Reveal } from "./Reveal";

/*
 * Lenses — the four domains, each its own painterly scene + one line. Depth is the art,
 * not any gradient. Names carry the domain hue via inline var() (app pattern). The grid
 * is 1-col on mobile (the fidelity gate) and 2-col from md.
 */
type Lens = { name: string; hue: string; art: ArtKey; line: string };

const LENSES: Lens[] = [
  {
    name: "Health",
    hue: "var(--dom-health)",
    art: "health.run_dawn",
    line: "Rings for the body. Meals, water, workouts — estimated from a word or a photo.",
  },
  {
    name: "Money",
    hue: "var(--dom-money)",
    art: "money.ledger",
    line: "A ledger that reads your receipts. Categorized spend, recurring detection, safe-to-spend.",
  },
  {
    name: "Habits",
    hue: "var(--dom-habits)",
    art: "habit.journal",
    line: "Streaks that bend, not break. Ramps, stacking, grace days.",
  },
  {
    name: "Skills",
    hue: "var(--dom-skills)",
    art: "skills.whiteboard",
    line: "Mastery by the hour. A roadmap for anything, logged as you go.",
  },
];

export function Lenses() {
  return (
    <section className="border-t border-line bg-raised">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8 sm:py-32">
        <Reveal className="max-w-2xl">
          <h2 className="font-coach text-display-xl tracking-tight text-ink-1">
            Four domains. Four deliberately-unalike lenses.
          </h2>
          <p className="mt-4 font-ui text-body leading-relaxed text-ink-2">
            Build the pipeline once; a new domain is then just a schema and a lens.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          {LENSES.map((lens, i) => (
            <Reveal key={lens.name} delay={0.05 * i}>
              <article className="flex flex-col">
                <ArtFrame artKey={lens.art} ratio="aspect-[16/10] w-full" />
                <h3 className="mt-5 flex items-center gap-2 font-coach text-title text-ink-1">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lens.hue }} />
                  {lens.name}
                </h3>
                <p className="mt-2 max-w-md font-ui text-body leading-relaxed text-ink-2">{lens.line}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
