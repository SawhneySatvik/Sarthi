"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Award, Check, Flame, Gem } from "lucide-react";
import Link from "next/link";

import { ArtFrame } from "@/components/art/ArtFrame";
import { Card } from "@/components/ui/Card";
import { StatPill } from "@/components/ui/StatPill";
import type { ArcCompleteSummary, TodayDomain, TodayStat } from "@/core/domains/today";

/*
 * UIE-0e (D-053(c)) — the arc-complete celebration day-state. Two read-only surfaces built
 * from a pure `ArcCompleteSummary`: `ArcCompleteCard` (S1, the full spine-area moment) and
 * `ArcSettledBanner` (S2, a compact acknowledgement above a live spine). Tokens-only
 * (invariant #4); on-art type over the 0b `--scrim-art` band. The ONE amber accent in the
 * whole product's arc-completion moment is the S1 eyebrow marker glyph (DESIGN §4 allowlist,
 * approved 2026-07-20) — never on S2, never on the span/counts text.
 */

// framer needs plain numbers; these mirror the CSS motion tokens (invariant #4 spirit):
// entrance = --t-base (200ms), marker pulse-once = --t-hero (900ms). No new motion tokens.
const MOTION = { entranceSec: 0.2, reduceFadeSec: 0.15, pulseSec: 0.9 } as const;

const DOMAIN_STRONG: Record<TodayDomain, string> = {
  health: "text-health-strong",
  money: "text-money-strong",
  habits: "text-habits-strong",
  skills: "text-skills-strong",
};
const DOMAIN_LABEL: Record<TodayDomain, string> = {
  health: "Health",
  money: "Money",
  habits: "Habits",
  skills: "Skills",
};

/** Display-only humanization of a YYYY-MM-DD (parsed as a plain calendar day, no TZ shift). */
function humanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** S1 — the full arc-complete celebration that replaces the spine area (SCREEN-TODAY §6 super). */
export function ArcCompleteCard({ summary, stat }: { summary: ArcCompleteSummary; stat: TodayStat }) {
  const reduce = useReducedMotion();
  const hasCounts = summary.tasksTotal > 0;
  const domainChips = (Object.keys(summary.perDomainDone) as TodayDomain[]).filter(
    (domain) => summary.perDomainDone[domain] > 0,
  );

  return (
    <div className="px-4 pt-8">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? MOTION.reduceFadeSec : MOTION.entranceSec, ease: "easeOut" }}
      >
        {/* ratio="min-h-72" replaces ArtFrame's default `aspect-video` so the card grows to
            fit its content at any width (a fixed aspect clipped the CTAs on desktop). The art
            fills behind via the `fill` Image; content defines the height, min 18rem. */}
        <ArtFrame artKey="today.arc_complete" eager ratio="min-h-72 w-full">
          <div className="flex h-full flex-col justify-end gap-3 p-5 sm:p-6">
            {/* Eyebrow — the ONE amber accent on this surface (DESIGN §4 arc-completion marker). */}
            <div className="flex items-center gap-2">
              <motion.span
                aria-hidden
                initial={false}
                animate={reduce ? undefined : { scale: [1, 1.18, 1] }}
                transition={reduce ? undefined : { duration: MOTION.pulseSec, ease: "easeOut", times: [0, 0.5, 1] }}
                className="text-energy"
              >
                <Award size={16} strokeWidth={1.75} />
              </motion.span>
              {/* Amber is the glyph ONLY (§11.5 sign-off); the caption follows the AllDone
                  eyebrow register in on-art ink, never amber. */}
              <span className="font-ui text-caption uppercase tracking-wide on-art-dim">Arc complete</span>
            </div>

            <p className="font-display text-title on-art">{summary.title}</p>

            <p className="font-ui text-body on-art-dim tabular-nums">
              Day {summary.lengthDays} of {summary.lengthDays} · {humanDate(summary.startDate)}–{humanDate(summary.endDate)}
              {summary.daysEngaged > 0
                ? ` · showed up ${summary.daysEngaged} ${summary.daysEngaged === 1 ? "day" : "days"}`
                : ""}
            </p>

            {hasCounts && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-ui text-body on-art tabular-nums">
                  {summary.tasksDone} of {summary.tasksTotal} tasks done
                </span>
                {domainChips.map((domain) => (
                  <span key={domain} className={`font-ui text-caption tabular-nums ${DOMAIN_STRONG[domain]}`}>
                    {DOMAIN_LABEL[domain]} {summary.perDomainDone[domain]}
                  </span>
                ))}
              </div>
            )}

            {/* Current standing — labeled as standing, never a fabricated per-arc XP delta (invariant #1). */}
            <div className="flex items-center gap-3">
              <span className="font-ui text-caption uppercase tracking-wide on-art-dim">Now</span>
              <StatPill tone={stat.level > 1 ? "energy" : "muted"} onArt icon={<Gem size={13} strokeWidth={1.5} aria-hidden />}>
                Lv {stat.level}
              </StatPill>
              <StatPill tone={stat.streak > 0 ? "energy" : "muted"} onArt icon={<Flame size={13} strokeWidth={1.5} aria-hidden />}>
                {stat.streak}
              </StatPill>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Link
                href="/journey"
                className="inline-flex min-h-11 items-center rounded-chip bg-ink-1 px-4 font-ui text-body text-canvas"
              >
                Reflect on this arc
              </Link>
              <Link
                href="/coach"
                className="inline-flex min-h-11 items-center font-ui text-body on-art underline decoration-line underline-offset-4"
              >
                Ask your coach what’s next
              </Link>
            </div>
          </div>
        </ArtFrame>
      </motion.div>
    </div>
  );
}

/** S2 — a compact "arc settled" row above a live spine. No amber; the live arc keeps the stage. */
export function ArcSettledBanner({ summary }: { summary: ArcCompleteSummary }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : MOTION.entranceSec }}
      className="px-4 pt-2"
    >
      <Card className="flex items-center gap-3 py-3">
        <Check size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-ok" />
        <p className="min-w-0 flex-1 font-ui text-body text-ink-2">
          <span className="text-ink-1">“{summary.title}”</span> settled
          {summary.tasksTotal > 0 ? ` · ${summary.tasksDone}/${summary.tasksTotal} tasks` : ""}
        </p>
        <Link
          href="/journey"
          className="shrink-0 font-ui text-caption text-ink-2 underline decoration-line underline-offset-4"
        >
          Reflect →
        </Link>
      </Card>
    </motion.div>
  );
}
