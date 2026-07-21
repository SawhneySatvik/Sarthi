import Link from "next/link";

import { ArtFrame } from "@/components/art/ArtFrame";

import { Nav } from "./Nav";
import { Reveal } from "./Reveal";
import { TryDemoCTA } from "./cta";

/*
 * Hero — full-bleed painterly dawn art (the ONLY source of hero depth; no synthetic
 * gradient atmosphere). The ArtFrame carries its own dark bottom scrim, so the
 * headline + CTAs sit at the bottom over legible on-art inks. A short top scrim
 * (scrim token → transparent) is the ONE overlay, added only so the transparent nav
 * stays readable over a bright sky — a legibility scrim over art, not depth.
 */
export function Hero() {
  return (
    <section className="relative isolate min-h-dvh overflow-hidden bg-canvas">
      <div className="absolute inset-0 -z-10">
        <ArtFrame artKey="today.header.dawn" eager ratio="h-full w-full rounded-none border-0" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-28 bg-[linear-gradient(to_bottom,var(--scrim),transparent)]" />

      <Nav />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-end px-6 pb-20 pt-32 sm:px-8">
        <Reveal className="max-w-3xl">
          <h1 className="font-coach text-display-xl md:text-hero on-art">One sentence. Your whole life, sorted.</h1>
          <p className="mt-6 max-w-2xl font-ui text-body leading-relaxed on-art-dim">
            Speak one messy line — &ldquo;spent ₹340 on lunch, 90 min of system design, woke at 5:10&rdquo; — and Sarthi
            files it across Health, Money, Habits and Skills at once. Nothing estimated is written until you confirm.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <TryDemoCTA />
            <Link
              href="/waitlist"
              className="inline-flex min-h-11 items-center font-ui text-body on-art underline-offset-4 transition-opacity duration-[var(--t-base)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Join the waitlist
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
