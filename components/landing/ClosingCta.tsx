import { ArtFrame } from "@/components/art/ArtFrame";

import { CtaLink } from "./CtaLink";
import { Reveal } from "./Reveal";

/*
 * Closing CTA — a calm summit (mile.arc_complete) with the two routes repeated. Overlay
 * text is Display + one Fraunces coach line only (DESIGN §8); CTAs stay neutral (never
 * amber). Scrim keeps ink-1 legible in both Bone modes.
 */
export function ClosingCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16 lg:pb-20">
      <Reveal>
        <ArtFrame
          artKey="mile.arc_complete"
          ratio="aspect-[3/4] sm:aspect-[16/8] lg:aspect-[21/9]"
          className="shadow-[var(--elev-card)]"
        >
          <div className="flex h-full flex-col items-start justify-end gap-5 p-8 lg:p-12">
            <h2 className="on-art max-w-lg font-display text-display tracking-tight">
              Your day, already in order.
            </h2>
            <p className="on-art max-w-md font-coach text-title leading-[var(--leading-coach)]">
              &ldquo;Let&rsquo;s begin. I&rsquo;ll take it from your first sentence.&rdquo;
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <CtaLink href="/api/try-demo" variant="primary" native onArt>
                Try the demo
              </CtaLink>
              <CtaLink href="/api/start-fresh" variant="ghost" native onArt>
                Start fresh
              </CtaLink>
            </div>
          </div>
        </ArtFrame>
      </Reveal>
    </section>
  );
}
