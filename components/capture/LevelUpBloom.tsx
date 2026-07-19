"use client";

import { motion, useReducedMotion } from "framer-motion";

import { MOTION } from "./motion";

/*
 * Inline level-up moment (SAR-006, D-F). A soft amber radial bloom sits BEHIND a
 * legible "Level up" label (not amber-on-amber) — one of the sanctioned `--energy`
 * surfaces (invariant #4: level-up). ≤900ms, fires once, never modal;
 * `prefers-reduced-motion` collapses the scale animation to a static flash.
 */
export function LevelUpBloom() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: reduce ? 0 : MOTION.bloomSec, ease: "easeOut" }}
      className="relative mb-1 flex items-center justify-center py-2"
    >
      <span
        aria-hidden
        className="absolute h-10 w-24 rounded-chip"
        style={{ background: "radial-gradient(ellipse, var(--energy), transparent 70%)", opacity: 0.35 }}
      />
      <span className="relative font-display text-caption uppercase tracking-wide text-energy">Level up</span>
    </motion.div>
  );
}
