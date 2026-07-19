"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { ArtFrame } from "@/components/art/ArtFrame";
import type { DisplayDomain, StatsCardView, StatsView } from "@/core/game";

type Face = "current" | "potential" | "dayone";

const domains: Record<DisplayDomain, { label: string; labelClass: string; railClass: string; gradient: string }> = {
  health: { label: "Health", labelClass: "relative font-ui text-caption uppercase tracking-wide text-health", railClass: "relative mt-3 h-px bg-health opacity-50", gradient: "radial-gradient(circle at 50% 0%, var(--dom-health), transparent 68%)" },
  money: { label: "Money", labelClass: "relative font-ui text-caption uppercase tracking-wide text-money", railClass: "relative mt-3 h-px bg-money opacity-50", gradient: "radial-gradient(circle at 50% 0%, var(--dom-money), transparent 68%)" },
  habits: { label: "Habits", labelClass: "relative font-ui text-caption uppercase tracking-wide text-habits", railClass: "relative mt-3 h-px bg-habits opacity-50", gradient: "radial-gradient(circle at 50% 0%, var(--dom-habits), transparent 68%)" },
  skills: { label: "Skills", labelClass: "relative font-ui text-caption uppercase tracking-wide text-skills", railClass: "relative mt-3 h-px bg-skills opacity-50", gradient: "radial-gradient(circle at 50% 0%, var(--dom-skills), transparent 68%)" },
};

const faces: readonly { id: Face; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "potential", label: "Potential" },
  { id: "dayone", label: "Day-1" },
];

export function StatsWall({ view }: { view: StatsView }) {
  const [face, setFace] = useState<Face>("current");
  const reduceMotion = useReducedMotion();
  const flipDuration = useTokenDuration();
  const earnedOverall = view.overall.xp > 0 || view.overall.level > 1 || view.overall.streak > 0;
  const potentialUnavailable = face === "potential" && !view.potentialAvailable;

  return (
    <div className="mx-auto max-w-[72rem] px-4 pb-8">
      <ArtFrame artKey="mile.levelup" ratio="h-20" className="mb-3"><p className="flex h-full items-end p-3 font-display text-title text-ink-1">Stats</p></ArtFrame>
      <div role="tablist" aria-label="Stats view" className="mt-2 flex rounded-chip border border-line p-1">
        {faces.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`stats-${item.id}`}
            aria-controls="stats-wall"
            aria-selected={face === item.id}
            onClick={() => setFace(item.id)}
            className={face === item.id ? "min-h-11 flex-1 rounded-chip bg-raised font-ui text-caption text-ink-1" : "min-h-11 flex-1 rounded-chip font-ui text-caption text-ink-2"}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id="stats-wall" role="tabpanel" aria-labelledby={`stats-${face}`} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <motion.section
          key={`overall-${face}`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -90 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotateY: 0 }}
          transition={{ duration: reduceMotion ? 0 : flipDuration, ease: [0.2, 0, 0, 1] }}
          style={{ transformPerspective: "var(--space-shell)" }}
          className="relative min-h-56 overflow-hidden rounded-card border border-line bg-card p-5 shadow-[var(--elev-card)]"
        >
          {earnedOverall && <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.1]" style={{ background: "radial-gradient(circle at 50% 0%, var(--energy), transparent 68%)" }} />}
          <p className={earnedOverall ? "relative font-ui text-caption uppercase tracking-wide text-energy" : "relative font-ui text-caption uppercase tracking-wide text-ink-3"}>Overall</p>
          {face === "potential" ? (
            <FaceUnavailable />
          ) : face === "dayone" ? (
            <div className="relative mt-5">
              <p className="font-display text-title tabular-nums text-ink-1">Day-1 reflection</p>
              <p className="mt-2 font-ui text-body text-ink-2">Each domain below shows its frozen starting point beside today.</p>
            </div>
          ) : (
            <div className="relative mt-2">
              <p className={earnedOverall ? "font-display text-display-xl tabular-nums text-energy" : "font-display text-display-xl tabular-nums text-ink-1"}>L{view.overall.level}</p>
              <p className="mt-2 font-ui text-body tabular-nums text-ink-1"><span className={view.overall.xp > 0 ? "text-energy" : "text-ink-1"}>{view.overall.xp} XP</span> <span className="text-ink-3">·</span> Day {view.overall.day} <span className="text-ink-3">·</span> <span className={view.overall.streak > 0 ? "text-energy" : "text-ink-1"}>best {view.overall.streak}</span></p>
              <div className="mt-6 h-px bg-line" aria-hidden />
              <p className="mt-3 font-ui text-caption text-ink-2">Your earned progress across the four lives.</p>
            </div>
          )}
        </motion.section>

        <div className="grid grid-cols-2 gap-3">
          {view.cards.map((card) => <DomainCard key={card.domain} card={card} face={face} unavailable={potentialUnavailable} reduceMotion={reduceMotion} flipDuration={flipDuration} />)}
        </div>
      </div>
    </div>
  );
}

function FaceUnavailable() {
  return <div className="relative mt-5"><p className="font-display text-title text-ink-1">Not enough data</p><p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">Keep a few days of honest rhythm and this view will have something real to project.</p></div>;
}

function DomainCard({ card, face, unavailable, reduceMotion, flipDuration }: { card: StatsCardView; face: Face; unavailable: boolean; reduceMotion: boolean | null; flipDuration: number }) {
  const domain = domains[card.domain];
  const dayOneAvailable = card.dayOne !== null;
  const value = unavailable ? card.headline : face === "dayone" ? (card.dayOne ?? "Day-1 not captured") : card.headline;
  const supporting = unavailable ? "not enough data" : face === "dayone" ? (dayOneAvailable ? "then → now" : "an immutable snapshot was not saved") : card.detail;

  return (
    <motion.div
      key={`${card.domain}-${face}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: 90 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotateY: 0 }}
      transition={{ duration: reduceMotion ? 0 : flipDuration, ease: [0.2, 0, 0, 1] }}
      style={{ transformPerspective: "var(--space-shell)" }}
    >
      <Link href={`/today?domain=${card.domain}`} aria-label={`${domain.label}: ${value}. ${supporting}. ${card.sparklineText}`} className="relative block min-h-52 overflow-hidden rounded-card border border-line bg-card p-4 shadow-[var(--elev-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.1]" style={{ background: domain.gradient }} />
        <p className={domain.labelClass}>{domain.label}</p>
        <p className="relative mt-4 font-display text-title tabular-nums text-ink-1">{value}</p>
        <p className="relative mt-2 font-ui text-caption text-ink-2">{supporting}</p>
        {unavailable ? <p className="relative mt-5 font-ui text-caption text-ink-3">Current value shown</p> : <><p className="relative mt-5 font-ui text-caption tabular-nums text-ink-3">L{card.level}</p><p className="sr-only">{card.sparklineText}</p><div className={domain.railClass} aria-hidden /></>}
      </Link>
    </motion.div>
  );
}

/** Motion reads the design-system duration rather than introducing a second timing value. */
function useTokenDuration() {
  const [seconds] = useState(() => {
    if (typeof window === "undefined") return 0;
    const milliseconds = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--t-base"));
    return Number.isFinite(milliseconds) ? milliseconds / 1000 : 0;
  });
  return seconds;
}
