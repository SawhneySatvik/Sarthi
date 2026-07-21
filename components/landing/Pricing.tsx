import { Reveal } from "./Reveal";
import { TryDemoCTA, WaitlistCTA } from "./cta";

/*
 * Pricing — two plans, deliberately amber-free (the landing's one --energy beat is the
 * moat's earned +18 XP chip; pricing stays neutral ink). Free is the keyless BYOK app;
 * Pro is managed AI, gated behind the waitlist. Never paywall the demo path (D-026).
 */
export function Pricing() {
  return (
    <section className="border-t border-line bg-raised">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8 sm:py-32">
        <Reveal className="max-w-2xl">
          <h2 className="font-coach text-display-xl tracking-tight text-ink-1">Start free. Bring your own key.</h2>
          <p className="mt-4 font-ui text-body leading-relaxed text-ink-2">
            The whole experience runs keyless on a deterministic stack. Add your own model key for live
            AI — or let us run it for you.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col rounded-card border border-line bg-canvas p-8">
              <p className="font-ui text-caption font-medium uppercase tracking-[0.14em] text-ink-3">Free</p>
              <p className="mt-3 font-coach text-display text-ink-1">Everything, keyless</p>
              <p className="mt-4 font-ui text-body leading-relaxed text-ink-2">
                The full app on the deterministic fake stack. Bring your own Gemini or OpenAI key for real
                captures — stored only in your browser, never on our servers, never logged.
              </p>
              <div className="mt-8">
                <TryDemoCTA />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="flex h-full flex-col rounded-card border border-line bg-canvas p-8">
              <p className="font-ui text-caption font-medium uppercase tracking-[0.14em] text-ink-3">
                Pro · coming soon
              </p>
              <p className="mt-3 font-coach text-display text-ink-1">Managed AI, no key</p>
              <p className="mt-4 font-ui text-body leading-relaxed text-ink-2">
                We run the models for you — parse, photo, and coach, fully hosted. No keys to manage.
                Join the waitlist for early access.
              </p>
              <div className="mt-8">
                <WaitlistCTA />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
