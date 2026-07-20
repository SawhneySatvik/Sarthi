"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import { MOTION } from "./motion";

/*
 * Scroll-reveal primitives for the landing page (DESIGN §5). Motion budget: a hero flourish
 * on load + staggered section entrances on scroll.
 *
 * Two guarantees, both load-bearing:
 *  1. prefers-reduced-motion parity — we ALWAYS render motion.div (never branch the element
 *     type on the client-only reduced flag, which would leave framer's server-set opacity:0
 *     inline style stuck after hydration). Reduced motion only collapses the entrance to a
 *     150ms opacity fade with no translate (DESIGN §5 "springs → 150ms fades").
 *  2. Always reaches visible. whileInView only fires on an intersection CHANGE, so an element
 *     already in view at mount (the hero) would stay hidden until a scroll. `immediate` drives
 *     the reveal on mount via `animate` for above-the-fold content; below-fold sections use
 *     whileInView and reveal as the user scrolls to them.
 */
const REDUCED_FADE_SEC = 0.15;
const VIEWPORT = { once: true, margin: "0px 0px -6% 0px" } as const;

/** A single element that fades + rises into view. `immediate` = animate on mount (hero). */
export function Reveal({
  children,
  className,
  delay = 0,
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  immediate?: boolean;
}) {
  const reduce = useReducedMotion();
  const visible = { opacity: 1, y: 0 };
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.risePx };
  const transition = reduce ? { duration: REDUCED_FADE_SEC } : { duration: MOTION.revealSec, ease: MOTION.ease, delay };
  const trigger = immediate ? { animate: visible } : { whileInView: visible, viewport: VIEWPORT };
  return (
    <motion.div className={className} initial={hidden} transition={transition} {...trigger}>
      {children}
    </motion.div>
  );
}

/** Parent that staggers its {@link StaggerItem} children in. `immediate` = on mount. */
export function Stagger({
  children,
  className,
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  immediate?: boolean;
}) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : MOTION.staggerSec } },
  };
  const trigger = immediate
    ? { animate: "show" as const }
    : { whileInView: "show" as const, viewport: VIEWPORT };
  return (
    <motion.div className={className} variants={variants} initial="hidden" {...trigger}>
      {children}
    </motion.div>
  );
}

/** A child of {@link Stagger}. Always resolves to visible; reduced motion = plain fade. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.risePx },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce ? { duration: REDUCED_FADE_SEC } : { duration: MOTION.revealSec, ease: MOTION.ease },
    },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}
