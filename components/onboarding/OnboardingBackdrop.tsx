"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useState } from "react";

import { ArtFrame } from "@/components/art/ArtFrame";
import type { ArtKey } from "@/components/art/registry";

import { OnboardingBackdropContext } from "./backdropContext";
import { MOTION } from "./motion";

/*
 * OnboardingBackdrop — UIE-5. The full-bleed painterly layer + the desktop split's reading
 * veil, lifted OUT of the ~528px question column so the art is genuinely full-viewport
 * (D-050). It renders a `fixed inset-0 -z-10` art plane behind the whole flow, crossfading
 * the per-phase art key (supplied by OnboardingFlow through the context bus). The gradient
 * placeholder is gone — ArtFrame carries its own grained plate fallback, so a slow/missing
 * WebP still reveals an intentional surface, never a flat rectangle.
 *
 * Readability: type sits on the LIGHT `.on-art` inks, so the veils use `--scrim-art`
 * (dark-biased in BOTH light and dark modes — unlike `--scrim`, which flips light on paper).
 *  · Mobile: a top+bottom `--scrim-art` band keeps the centered column AA while the painterly
 *    middle breathes.
 *  · Desktop (`lg:`): a horizontal ramp — art celebrated on the open left pane, a solid
 *    `--scrim-art` reading wall under the right ~34rem question column (kills the side voids).
 * Reduced motion: the crossfade collapses to an instant swap (no cross-dissolve).
 */

// Mobile veil — solid `--scrim-art` at the title band (top) and CTA band (bottom); the
// painterly middle relaxes to a partial veil (color-mix keeps it dark enough that centered
// type — the Phase-C "Drafting your plans…" label — still passes AA) while the art breathes.
const MOBILE_VEIL =
  "linear-gradient(to bottom, var(--scrim-art) 0%, color-mix(in oklab, var(--scrim-art) 70%, transparent) 40%, color-mix(in oklab, var(--scrim-art) 70%, transparent) 60%, var(--scrim-art) 100%)";
// Desktop veil — the question column is pinned to the right (~34rem); ramp to a solid
// reading wall there so on-art type passes AA, while the left pane celebrates the art.
const DESKTOP_VEIL =
  "linear-gradient(to right, transparent 0%, transparent 42%, var(--scrim-art) 64%, var(--scrim-art) 100%)";

export function OnboardingBackdrop({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  // Seed with the Welcome art so the very first paint is the real backdrop, not a flash of
  // bare canvas before the flow's mount effect pushes its first key.
  const [artKey, setArtKey] = useState<ArtKey | null>("onboard.welcome");

  return (
    <OnboardingBackdropContext.Provider value={{ artKey, setArtKey }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-canvas">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={artKey ?? "none"}
            className="absolute inset-0"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reduce ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : MOTION.crossfadeSec, ease: MOTION.ease }}
          >
            {artKey && (
              <ArtFrame
                artKey={artKey}
                eager={artKey === "onboard.welcome"}
                ratio=""
                className="h-full w-full rounded-none border-0"
              />
            )}
          </motion.div>
        </AnimatePresence>
        {/* Readability veils — `--scrim-art` (dark-biased both modes) so `.on-art` inks pass AA.
            Only when there IS art: the post-accept phases carry no art + normal inks, so a veil
            there would darken the pane into dark-on-dark. */}
        {artKey && (
          <>
            <div className="absolute inset-0 lg:hidden" style={{ background: MOBILE_VEIL }} />
            <div className="absolute inset-0 hidden lg:block" style={{ background: DESKTOP_VEIL }} />
          </>
        )}
      </div>
      {children}
    </OnboardingBackdropContext.Provider>
  );
}
