"use client";

import { motion, useReducedMotion } from "framer-motion";

import { MOTION } from "./motion";

/*
 * Inline level-up bloom (SAR-006, D-F). Amber radial bloom ≤900ms, fires once, never
 * modal — one of the sanctioned `--energy` surfaces (invariant #4: level-up).
 * `prefers-reduced-motion` collapses it to a static amber flash (real, via the hook).
 */
export function LevelUpBloom() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={reduce ? { opacity: 1 } : { scale: 1, opacity: [0, 1, 0.75] }}
      transition={{ duration: reduce ? 0 : MOTION.bloomSec, ease: "easeOut" }}
      className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-chip"
      style={{ background: "radial-gradient(circle, var(--energy), transparent)" }}
    >
      <span className="font-display text-caption text-energy">Level up</span>
    </motion.div>
  );
}
