"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

/*
 * Reveal — the landing's calm scroll entrance. A subtle fade + rise as a block scrolls into
 * view (DESIGN §5: everything non-choreographed is a calm fade/slide). The easing curve
 * equals --ease-standard (cubic-bezier 0.2,0,0,1).
 *
 * Reduced-motion parity (mandatory): we do NOT branch the element type on
 * `useReducedMotion` — the SSR render can't see the client preference (it always emits the
 * animated `opacity:0`), so a plain-element reduced branch would strand the hero copy
 * invisible on hydration. Instead we always render the motion element and, under reduced
 * motion, drive opacity→1 via `animate` (fires on mount, no scroll dependency) with a 0ms
 * transition and no rise — instant, static, and layout-identical to the rest state.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();

  const anim: HTMLMotionProps<"div"> = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-64px" },
        transition: { duration: 0.55, ease: [0.2, 0, 0, 1], delay },
      };

  return (
    <motion.div {...anim} className={className}>
      {children}
    </motion.div>
  );
}
