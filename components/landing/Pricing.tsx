import { Check, KeyRound, Sparkles } from "lucide-react";

import { CtaLink } from "./CtaLink";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

/*
 * Pricing — two on-brand plans (tokens-only, and deliberately AMBER-FREE: the one earned
 * amber beat is the hero demo's +XP; §4). Free = "bring your own key" (paste your own
 * Gemini/OpenAI key, kept in-browser; the seeded demo is always free). Pro = "we run the AI
 * for you" (no key needed, a deeper coach + richer art). The Pro card carries a quiet skills-hued
 * accent — a domain hue, never amber. Cards are single surfaces (no card-of-cards, DESIGN §11).
 */

type Plan = {
  name: string;
  Icon: typeof KeyRound;
  headline: string;
  blurb: string;
  features: readonly string[];
  cta: { label: string; href: string; variant: "primary" | "ghost"; native?: boolean };
  featured?: boolean;
};

const PLANS: readonly Plan[] = [
  {
    name: "Free",
    Icon: KeyRound,
    headline: "Bring your own key",
    blurb: "Paste your Gemini or OpenAI key — it stays in your browser, never on our servers. The seeded demo is always free, no key required.",
    features: [
      "The full four-domain capture pipeline",
      "Your key, stored in-browser only",
      "Seeded demo persona, always free",
    ],
    cta: { label: "Start fresh", href: "/api/start-fresh", variant: "ghost", native: true },
  },
  {
    name: "Pro",
    Icon: Sparkles,
    headline: "We run the AI for you",
    blurb: "No key to manage — Sarthi runs the models. A deeper three-tier coach, richer generated art, and priority on new domains.",
    features: [
      "No key needed — we run the models",
      "Deeper coach: reacts, briefs, reflects",
      "Richer art + first access to new domains",
    ],
    cta: { label: "Join the waitlist", href: "/waitlist", variant: "primary" },
    featured: true,
  },
];

export function Pricing() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
      <Reveal className="flex flex-col gap-3">
        <p className="font-ui text-caption uppercase tracking-[0.22em] text-ink-2">Pricing</p>
        <h2 className="max-w-2xl font-display text-display tracking-tight text-ink-1">
          Two ways in. Both keep the demo free.
        </h2>
        <p className="max-w-xl font-ui text-body text-ink-2">
          Run it on your own key, or let us run the models for you. Judges and demo users always
          get the full seeded experience, free — no paywall on the path.
        </p>
      </Reveal>

      <Stagger className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {PLANS.map((plan) => (
          <StaggerItem
            key={plan.name}
            className={`relative flex flex-col gap-6 overflow-hidden rounded-card border border-line bg-card p-7 shadow-[var(--elev-card)] ${
              plan.featured ? "lens-atmo-skills" : ""
            }`}
          >
            {plan.featured && (
              <span className="absolute inset-x-0 top-0 h-0.5 bg-skills" aria-hidden />
            )}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <plan.Icon size={16} className={plan.featured ? "text-skills-strong" : "text-ink-2"} aria-hidden />
                  <span className="font-ui text-caption uppercase tracking-[0.18em] text-ink-3">{plan.name}</span>
                </div>
                <h3 className="font-display text-title text-ink-1">{plan.headline}</h3>
              </div>
            </div>

            <p className="font-ui text-body text-ink-2">{plan.blurb}</p>

            <ul className="flex flex-col gap-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 font-ui text-body text-ink-2">
                  <Check
                    size={16}
                    className={`mt-0.5 shrink-0 ${plan.featured ? "text-skills-strong" : "text-ink-3"}`}
                    aria-hidden
                  />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-1">
              <CtaLink
                href={plan.cta.href}
                variant={plan.cta.variant}
                native={plan.cta.native}
                className="w-full sm:w-auto"
              >
                {plan.cta.label}
              </CtaLink>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
