/**
 * components/onboarding/motion.ts — motion constants for the onboarding flow. framer-motion
 * needs plain numbers, so these mirror the CSS motion tokens in one documented place
 * (invariant #4 spirit): step crossfade = --t-base (200ms), rise + ease = --ease-standard.
 * The CORE progress hairline is a thin position indicator (not a reward), so it stays hair-thin.
 */
export const MOTION = {
  /** Step crossfade — mirrors --t-base (200ms). */
  crossfadeSec: 0.2,
  /** Vertical rise/fall (px) on step enter/exit. */
  risePx: 12,
  /** Standard ease — mirrors --ease-standard. */
  ease: [0.2, 0, 0, 1],
  /** Progress hairline thickness (px) — a position indicator, not a reward bar. */
  hairlinePx: 2,
} as const;
