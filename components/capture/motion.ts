/**
 * components/capture/motion.ts — motion constants for the capture sheet. framer-motion
 * needs plain numbers, so these mirror the CSS motion tokens in one documented place
 * (invariant #4 spirit): sheet slide = --t-slow (320ms), bloom = --t-hero (900ms).
 */
export const MOTION = {
  /** Sheet slide — mirrors --t-slow (320ms). */
  sheetSlideSec: 0.32,
  /** Level-up bloom — mirrors --t-hero (900ms). */
  bloomSec: 0.9,
  /** Long-press-to-flip ("why") arming delay. */
  holdToFlipMs: 450,
  /** Horizontal swipe distance (px) that commits an accept/discard. */
  swipeThreshold: 120,
} as const;
