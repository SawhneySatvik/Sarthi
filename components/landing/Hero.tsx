import { CtaLink } from "./CtaLink";
import { LiveCaptureDemo } from "./LiveCaptureDemo";
import { Reveal } from "./Reveal";

/*
 * Hero — the one focal viewport (DESIGN §1). Split editorial layout: the promise + CTAs on
 * the warm, atmosphere-lit canvas at left; the ⭐ LIVE CAPTURE DEMO at right — a self-running,
 * deterministic animation of one spoken line parsing into four typed domains (the moat, moving).
 * Type stays within the mapped scale (display-xl ceiling); presence comes from whitespace, the
 * atmosphere glow, and the demo — not an invented type step. The सारथी line and CTAs are kept.
 */
export function Hero() {
  return (
    <section className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:py-24">
      <div className="flex flex-col gap-6">
        <Reveal immediate>
          <p className="font-ui text-caption uppercase tracking-[0.22em] text-ink-2">
            Voice-and-photo life coach
          </p>
        </Reveal>
        <Reveal immediate delay={0.08}>
          <h1 className="font-display text-display-xl tracking-tight text-ink-1">
            Your whole life,
            <br />
            from one sentence.
          </h1>
        </Reveal>
        <Reveal immediate delay={0.16}>
          <p className="max-w-md font-ui text-body text-ink-2">
            Speak one messy line. Sarthi turns it into typed entries across Health, Money,
            Habits and Skills — files what&rsquo;s certain, asks about the rest, then coaches
            you forward.
          </p>
        </Reveal>
        <Reveal immediate delay={0.24}>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <CtaLink href="/api/try-demo" variant="primary" native>
              Try the demo
            </CtaLink>
            <CtaLink href="/api/start-fresh" variant="ghost" native>
              Start fresh
            </CtaLink>
          </div>
        </Reveal>
        <Reveal immediate delay={0.32}>
          <p className="font-coach text-title leading-[var(--leading-coach)] text-ink-2">
            सारथी — the charioteer who steers the rider.
          </p>
        </Reveal>
      </div>

      <Reveal immediate delay={0.2}>
        <LiveCaptureDemo />
      </Reveal>
    </section>
  );
}
