import { CircleDot, ReceiptText, TrendingUp, Utensils, type LucideIcon } from "lucide-react";

import { Reveal, Stagger, StaggerItem } from "./Reveal";

/*
 * The four-lens differentiator — now EDITORIAL: an asymmetric 6-col rhythm (wide · narrow /
 * narrow · wide) rather than a flat 2×2, each card washed in its own domain hue (the
 * lens-atmo-* glow, globals.css). Data-first (art belongs to the emotional bands — DESIGN
 * §8/ASSETS §3). Domain hue reads as a left-edge tick + a hued icon and title (the -strong
 * variant for AA on bg-card, DESIGN §4). No nested cards. Class names are LITERAL strings so
 * Tailwind's scanner emits the domain + span utilities (same pattern as components/today/domain.ts).
 */

type Lens = {
  name: string;
  mode: string;
  lens: string;
  desc: string;
  Icon: LucideIcon;
  tick: string;
  hue: string;
  atmo: string;
  span: string;
};

const LENSES: readonly Lens[] = [
  {
    name: "Health",
    mode: "daily arc",
    lens: "dashboard",
    desc: "Estimates kcal, macros and burn from a spoken line or a photo, then adapts the workout to the day you actually had.",
    Icon: Utensils,
    tick: "bg-health",
    hue: "text-health-strong",
    atmo: "lens-atmo-health",
    span: "lg:col-span-4",
  },
  {
    name: "Money",
    mode: "arc + ledger",
    lens: "ledger",
    desc: "Parses receipts, categorizes in integer paise, catches the recurring charges and flags the quiet leaks.",
    Icon: ReceiptText,
    tick: "bg-money",
    hue: "text-money-strong",
    atmo: "lens-atmo-money",
    span: "lg:col-span-2",
  },
  {
    name: "Habits",
    mode: "daily arc",
    lens: "grid",
    desc: "Behaviour design — ramps targets gently, stacks new habits onto old ones, links what satisfies what.",
    Icon: CircleDot,
    tick: "bg-habits",
    hue: "text-habits-strong",
    atmo: "lens-atmo-habits",
    span: "lg:col-span-2",
  },
  {
    name: "Skills",
    mode: "mastery · hours",
    lens: "curriculum",
    desc: "Generates a roadmap for anything, logs the hours, and checkpoints the climb from first step to 100.",
    Icon: TrendingUp,
    tick: "bg-skills",
    hue: "text-skills-strong",
    atmo: "lens-atmo-skills",
    span: "lg:col-span-4",
  },
];

export function FourLenses() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
      <Reveal className="flex flex-col gap-3">
        <p className="font-ui text-caption uppercase tracking-[0.22em] text-ink-2">Four domains, four lenses</p>
        <h2 className="max-w-2xl font-display text-display tracking-tight text-ink-1">
          Built once. Unalike on purpose.
        </h2>
        <p className="max-w-xl font-ui text-body text-ink-2">
          One capture pipeline. Four typed stores. Four review lenses, each shaped to its
          domain — the whole moat is: build the pipeline once, and a new domain is just a
          schema and a lens.
        </p>
      </Reveal>

      <Stagger className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-6">
        {LENSES.map(({ name, mode, lens, desc, Icon, tick, hue, atmo, span }) => (
          <StaggerItem
            key={name}
            className={`relative flex min-h-[13rem] flex-col overflow-hidden rounded-card border border-line bg-card p-6 shadow-[var(--elev-card)] ${atmo} ${span}`}
          >
            <span className={`absolute inset-y-6 left-0 w-0.5 rounded-chip ${tick}`} aria-hidden />
            <div className="flex items-center gap-3">
              <Icon size={20} className={hue} aria-hidden />
              <h3 className={`font-display text-title ${hue}`}>{name}</h3>
              <span className="ml-auto rounded-chip border border-line px-2.5 py-1 font-ui text-caption text-ink-3">
                {mode}
              </span>
            </div>
            <p className="mt-4 font-ui text-body text-ink-2">{desc}</p>
            <p className="mt-auto pt-5 font-ui text-caption uppercase tracking-[0.16em] text-ink-3">{lens} lens</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
