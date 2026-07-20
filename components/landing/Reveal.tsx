"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/*
 * Reveal — the ONLY landing motion. A subtle fade + rise as a block scrolls into
 * view (DESIGN §5: everything non-choreographed is a calm --t-base fade/slide). The
 * easing curve equals --ease-standard (cubic-bezier 0.2,0,0,1). Under
 * prefers-reduced-motion it renders statically — motion is never the sole signal.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{ duration: 0.55, ease: [0.2, 0, 0, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
