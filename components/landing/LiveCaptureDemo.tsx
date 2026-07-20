"use client";

import { useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Mic, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { StatPill } from "@/components/ui/StatPill";

import { DEMO } from "./motion";

/*
 * ⭐ The hero centerpiece — a self-running, DETERMINISTIC capture demo (no API, keyless).
 * The one canonical spoken line types into a capture bar → a brief "reading…" shimmer →
 * the day parses into the FOUR domain cards, each in its own hue, staggering in. Explicit
 * facts show a "Filed" check; the lone estimated meal raises a "Confirm" affordance carrying
 * the page's single amber +XP beat (invariant #4 — earned, and the only amber on the page).
 *
 * Determinism + reduced-motion, done the Reveal.tsx way: the INITIAL render is the completed
 * end-state (line fully typed, all four cards in, Confirm + XP shown). So SSR, no-JS, and
 * `prefers-reduced-motion` all paint the finished frame with no hydration branch. Only the
 * effect drives it forward — and only when in view, looping while visible, paused off-screen.
 * `woke → Habits` per the canonical parse (docs/product/PROJECT.md): all four domains light up.
 */

const LINE =
  "Spent ₹340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design, woke at 5:10.";

type Row = {
  label: string;
  detail?: string;
  value: string;
  status: "filed" | "confirm";
};

type DomainCard = {
  domain: string;
  /** Literal domain utilities so Tailwind's scanner emits them (same law as FourLenses). */
  tick: string;
  hue: string;
  atmo: string;
  rows: readonly Row[];
  /** The card that holds the one estimate → the one amber +XP beat. */
  estimate?: boolean;
};

const CARDS: readonly DomainCard[] = [
  {
    domain: "Money",
    tick: "bg-money",
    hue: "text-money-strong",
    atmo: "lens-atmo-money",
    rows: [{ label: "Lunch", value: "−₹340", status: "filed" }],
  },
  {
    domain: "Health",
    tick: "bg-health",
    hue: "text-health-strong",
    atmo: "lens-atmo-health",
    estimate: true,
    rows: [
      { label: "Meal", detail: "2 rotis, dal", value: "~520 kcal", status: "confirm" },
      { label: "Water", detail: "one bottle", value: "500 ml", status: "filed" },
    ],
  },
  {
    domain: "Skills",
    tick: "bg-skills",
    hue: "text-skills-strong",
    atmo: "lens-atmo-skills",
    rows: [{ label: "System design", value: "90 min", status: "filed" }],
  },
  {
    domain: "Habits",
    tick: "bg-habits",
    hue: "text-habits-strong",
    atmo: "lens-atmo-habits",
    rows: [{ label: "Woke", value: "5:10 AM", status: "filed" }],
  },
];

type Phase = "typing" | "reading" | "parsing" | "done";

function StatusBadge({ status }: { status: Row["status"] }) {
  if (status === "filed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-chip border border-line px-2 py-0.5 font-ui text-caption text-ink-2">
        <Check size={12} aria-hidden />
        Filed
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-chip border border-line bg-raised px-2 py-0.5 font-ui text-caption text-ink-1">
      Confirm
      <ChevronRight size={12} aria-hidden />
    </span>
  );
}

export function LiveCaptureDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Initial state = the completed end-state (see file header). Never branch structure on a
  // client-only flag; the effect only ever advances an already-valid frame.
  const [typed, setTyped] = useState(LINE.length);
  const [phase, setPhase] = useState<Phase>("done");
  const [shown, setShown] = useState(CARDS.length);

  useEffect(() => {
    // Reduced motion → never start the sequence; the initial render is already the static
    // end-state (done · full line · all cards · Confirm+XP), and state only ever mutates via
    // play() from the async IntersectionObserver — never in this tick — so it stays put.
    if (reduce) return;
    const el = ref.current;
    if (!el) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let ticker: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const stop = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      if (ticker) {
        clearInterval(ticker);
        ticker = null;
      }
    };

    const play = () => {
      stop();
      if (cancelled) return;
      setPhase("typing");
      setTyped(0);
      setShown(0);
      let i = 0;
      ticker = setInterval(() => {
        i += 1;
        setTyped(i);
        if (i < LINE.length) return;
        if (ticker) {
          clearInterval(ticker);
          ticker = null;
        }
        // full line typed → a beat, then the reading shimmer, then the cards stagger in
        timers.push(
          setTimeout(() => {
            setPhase("reading");
            timers.push(
              setTimeout(() => {
                setPhase("parsing");
                for (let c = 1; c <= CARDS.length; c += 1) {
                  timers.push(setTimeout(() => setShown(c), DEMO.cardStepMs * c));
                }
                timers.push(
                  setTimeout(
                    () => {
                      setPhase("done");
                      timers.push(setTimeout(play, DEMO.holdMs)); // loop while in view
                    },
                    DEMO.cardStepMs * (CARDS.length + 1),
                  ),
                );
              }, DEMO.readingMs),
            );
          }, DEMO.cardStepMs),
        );
      }, DEMO.typeCharMs);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else stop(); // pause off-screen: calm, and no dangling timers
      },
      { threshold: 0.4 },
    );
    io.observe(el);

    return () => {
      cancelled = true;
      stop();
      io.disconnect();
    };
  }, [reduce]);

  const done = phase === "done";

  return (
    <div ref={ref} className="relative">
      <div aria-hidden className="demo-halo" />
      <div className="relative z-10 flex flex-col">
        {/* Capture bar — the spoken line types in, with a "reading…" shimmer between phases */}
        <div
          className={`relative overflow-hidden rounded-card border border-line bg-card p-4 shadow-[var(--elev-card)] ${
            phase === "reading" ? "animate-shimmer" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-chip border border-line text-ink-2">
              <Mic size={15} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-ui text-caption uppercase tracking-[0.18em] text-ink-3">Capturing</p>
              <p className="mt-1 font-ui text-body italic leading-snug text-ink-1">
                &ldquo;{LINE.slice(0, typed)}
                {phase === "typing" && <span className="landing-caret text-ink-2">|</span>}
                {typed >= LINE.length && "”"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 font-ui text-caption text-ink-3" aria-live="polite">
          <span className="h-px w-6 bg-line" aria-hidden />
          {phase === "reading" ? "reading…" : "parses into four domains"}
          <ChevronRight size={12} aria-hidden />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CARDS.map((card, idx) => (
            <div
              key={card.domain}
              data-shown={idx < shown}
              className={`demo-card relative overflow-hidden rounded-card border border-line bg-card p-4 shadow-[var(--elev-card)] ${card.atmo}`}
            >
              <span className={`absolute inset-y-4 left-0 w-0.5 rounded-chip ${card.tick}`} aria-hidden />
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-chip ${card.tick}`} aria-hidden />
                <span className={`font-display text-caption uppercase tracking-[0.14em] ${card.hue}`}>
                  {card.domain}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2.5">
                {card.rows.map((row) => (
                  <div key={row.label} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate font-ui text-body text-ink-1">{row.label}</span>
                        <span className="shrink-0 font-display text-body tabular-nums text-ink-2">{row.value}</span>
                      </div>
                      {row.detail && <p className="mt-0.5 truncate font-ui text-caption text-ink-3">{row.detail}</p>}
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                ))}
              </div>

              {card.estimate && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                  <span className="min-w-0 truncate font-ui text-caption text-ink-3">Confirm the one estimate</span>
                  <StatPill icon={<Zap size={12} aria-hidden />}>+18 XP</StatPill>
                </div>
              )}
            </div>
          ))}
        </div>

        {done && (
          <p className="mt-4 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
            &ldquo;Filed across four domains. Confirm the meal and your day&rsquo;s in order.&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
