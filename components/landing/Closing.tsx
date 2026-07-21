import Link from "next/link";

import { ArtFrame } from "@/components/art/ArtFrame";

import { Reveal } from "./Reveal";
import { TryDemoCTA } from "./cta";

/*
 * Closing — a final art band (today.rest) with the last call. The ArtFrame carries its
 * own scrim so the centered on-art headline + CTAs stay legible; no extra overlay.
 */
export function Closing() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <ArtFrame artKey="today.rest" ratio="h-full w-full rounded-none border-0" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-28 text-center sm:px-8 sm:py-36">
        <Reveal>
          <h2 className="font-coach text-display-xl md:text-hero on-art">Your whole life. One sentence away.</h2>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <TryDemoCTA />
            <Link
              href="/waitlist"
              className="inline-flex min-h-11 items-center font-ui text-body on-art underline-offset-4 transition-opacity duration-[var(--t-base)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              or join the waitlist
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
