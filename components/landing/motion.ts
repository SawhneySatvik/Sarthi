/**
 * components/landing/motion.ts — motion constants for the landing page. framer-motion
 * needs plain numbers, so these mirror the CSS motion tokens in one documented place
 * (invariant #4 spirit, matching components/capture/motion.ts): reveal = --t-slow (320ms),
 * base = --t-base (200ms), hero flourish stays inside the --t-hero (900ms) budget.
 * Every animation branches on prefers-reduced-motion at the component level.
 */
export const MOTION = {
  /** Section scroll-reveal — mirrors --t-slow (320ms). */
  revealSec: 0.32,
  /** Hero flourish — a single choreographed entrance, within the --t-hero budget. */
  heroSec: 0.6,
  /** Per-child stagger inside a group. */
  staggerSec: 0.08,
  /** Vertical rise (px) on reveal enter. */
  risePx: 16,
  /** Standard ease — mirrors --ease-standard cubic-bezier(0.2, 0, 0, 1). */
  ease: [0.2, 0, 0, 1] as const,
} as const;

/*
 * DEMO — wall-clock timings (ms) for the deterministic live-capture animation in the hero.
 * These drive setTimeout/setInterval (JS logic, not CSS styling), so they live here as named
 * constants rather than scattered magic numbers — same "one documented place" discipline as
 * MOTION. Fully deterministic: no API, no randomness. Reduced-motion skips the whole sequence
 * and renders the completed end-state, so these never run for reduced-motion users.
 */
export const DEMO = {
  /** Per-character typewriter cadence for the canonical spoken line. */
  typeCharMs: 26,
  /** The "reading…" shimmer beat between full line and the first parsed card. */
  readingMs: 780,
  /** Stagger between each domain card appearing. */
  cardStepMs: 300,
  /** Hold on the completed end-state before the loop restarts. */
  holdMs: 3200,
} as const;
