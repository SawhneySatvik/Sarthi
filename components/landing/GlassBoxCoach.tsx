import { ChevronRight, Undo2 } from "lucide-react";

import { ArtFrame } from "@/components/art/ArtFrame";

import { Reveal, Stagger, StaggerItem } from "./Reveal";

/*
 * The three-tier, glass-box coach. The one atmospheric band (coach.week_band) carries a
 * Fraunces coach line on imagery (Display/Fraunces on art only, DESIGN §8). Tiers are
 * hairline-divided rows inside one card. The adaptation panel shows the glass-box law
 * literally: before → after → reason, revertible — no nested cards, just a divided region.
 */

const TIERS: readonly { name: string; line: string }[] = [
  { name: "Reacts", line: "A line the moment you capture — read back, never generic." },
  { name: "Briefs", line: "Every morning, the day planned around the day you actually had." },
  { name: "Reflects", line: "Every week, the pattern named and the arc re-tuned." },
];

export function GlassBoxCoach() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
      <Reveal className="flex flex-col gap-3">
        <p className="font-ui text-caption uppercase tracking-[0.22em] text-ink-2">The three-tier coach</p>
        <h2 className="max-w-2xl font-display text-display tracking-tight text-ink-1">
          It reacts, briefs, reflects — and shows its work.
        </h2>
        <p className="max-w-xl font-ui text-body text-ink-2">
          A coach that reads your day back, plans the morning, reflects on the week, and
          changes the plan in the open — never behind your back.
        </p>
      </Reveal>

      <Reveal className="mt-10">
        <ArtFrame artKey="coach.week_band" ratio="aspect-[4/3] sm:aspect-[7/2] lg:aspect-[5/1]" className="shadow-[var(--elev-card)]">
          <div className="flex h-full items-end p-6">
            <p className="on-art max-w-xl font-coach text-title leading-[var(--leading-coach)]">
              &ldquo;You&rsquo;re 20 minutes over on lunch this week. I moved tonight&rsquo;s run
              to 6 AM — your mornings have been stronger.&rdquo;
            </p>
          </div>
        </ArtFrame>
      </Reveal>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Stagger className="rounded-card border border-line bg-card px-6 shadow-[var(--elev-card)]">
          {TIERS.map((tier, i) => (
            <StaggerItem
              key={tier.name}
              className={`flex items-start gap-4 py-5 ${i === 0 ? "" : "border-t border-line"}`}
            >
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-chip bg-ink-3" aria-hidden />
              <div>
                <p className="font-display text-title text-ink-1">{tier.name}</p>
                <p className="mt-1 font-ui text-body text-ink-2">{tier.line}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="rounded-card border border-line bg-card p-6 shadow-[var(--elev-card)]">
          <p className="font-ui text-caption uppercase tracking-[0.18em] text-ink-3">Glass-box adaptation</p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <p className="font-ui text-caption text-ink-3">Before</p>
              <p className="mt-1 font-ui text-body text-ink-3 line-through">Run · 30 min · 7:00 PM</p>
            </div>
            <ChevronRight size={18} className="text-ink-3" aria-hidden />
            <div>
              <p className="font-ui text-caption text-ink-3">After</p>
              <p className="mt-1 font-ui text-body text-ink-1">Run · 30 min · 6:00 AM</p>
            </div>
          </div>
          <p className="mt-5 border-t border-line pt-5 font-coach text-body leading-[var(--leading-coach)] text-ink-1">
            &ldquo;Your mornings have been your strongest this week.&rdquo;
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-chip border border-line px-3 py-1.5 font-ui text-caption text-ink-2">
            <Undo2 size={13} aria-hidden />
            Revert
          </span>
        </Reveal>
      </div>
    </section>
  );
}
