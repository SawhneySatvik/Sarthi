"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

/*
 * Reveal — the shared calm entrance for app surfaces (Today spine rows, Journey days).
 * A gentle fade + small rise as a block enters the viewport (`whileInView`, `once`), so
 * above-the-fold content settles on mount and below-fold content settles on scroll. It
 * NEVER gates interactivity: the rest state is opacity 1 / y 0, so the interactive card
 * inside (drag, Done/Skip) is fully usable the instant it mounts.
 *
 * framer-motion needs plain numbers, so the two values below mirror the CSS motion tokens
 * in one documented place (invariant #4 spirit, same convention as
 * components/{capture,onboarding}/motion.ts): duration = --t-slow (320ms), ease =
 * --ease-standard.
 *
 * Reduced-motion parity (mandatory): we NEVER branch the element *type* on
 * `useReducedMotion` — that diverges from the SSR render (which can't see the client
 * preference and always emits the animated `opacity:0`) and would strand content invisible
 * on hydration. Instead we always render the same motion element and, under reduced motion,
 * drive opacity→1 via `animate` (fires on mount, no scroll dependency) with a 0ms
 * transition and no rise. The reduced path is therefore instant + static and layout-identical
 * to the rest state — content can never be left hidden.
 */
const REVEAL_SEC = 0.32; // mirrors --t-slow (320ms)
const EASE = [0.2, 0, 0, 1] as const; // mirrors --ease-standard
const RISE_PX = 8;

type As = "div" | "section" | "li";

export function Reveal({
  as = "div",
  children,
  className,
  delay = 0,
}: {
  as?: As;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();

  const anim: HTMLMotionProps<"div"> = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: RISE_PX },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-32px" },
        transition: { duration: REVEAL_SEC, ease: EASE, delay },
      };

  if (as === "li")
    return (
      <motion.li {...(anim as HTMLMotionProps<"li">)} className={className}>
        {children}
      </motion.li>
    );
  if (as === "section")
    return (
      <motion.section {...(anim as HTMLMotionProps<"section">)} className={className}>
        {children}
      </motion.section>
    );
  return (
    <motion.div {...anim} className={className}>
      {children}
    </motion.div>
  );
}
