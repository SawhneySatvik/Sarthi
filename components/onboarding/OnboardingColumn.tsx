"use client";

import { type ReactNode } from "react";

import { useOnboardingBackdrop } from "./backdropContext";

/*
 * OnboardingColumn — UIE-5. The question column wrapper, art-aware. When the phase carries a
 * full-bleed backdrop (Welcome / CORE / spine / confirm), desktop splits into two panes: the
 * art is celebrated on the open left, the ~34rem column is pinned right over the backdrop's
 * reading veil (no side voids, D-050). The post-accept phases (interstitial / detail / theme /
 * landing) carry NO art and use normal inks, so there the column simply centers on every
 * breakpoint — no veil, no void, no dark-on-dark. Mobile is always the centered column (the
 * 390 fidelity gate).
 */
export function OnboardingColumn({ children }: { children: ReactNode }) {
  const { artKey } = useOnboardingBackdrop();
  const hasArt = artKey !== null;

  return (
    <div
      className={
        hasArt
          ? "relative z-10 min-h-screen w-full lg:grid lg:grid-cols-[1fr_minmax(0,34rem)]"
          : "relative z-10 min-h-screen w-full"
      }
    >
      {/* Desktop-only open art pane — only when there IS art to celebrate. */}
      {hasArt && <div aria-hidden className="hidden lg:block" />}
      <div
        className={
          hasArt
            ? "mx-auto flex min-h-screen w-full max-w-[33rem] flex-col px-5 lg:mx-0 lg:justify-center lg:px-12"
            : "mx-auto flex min-h-screen w-full max-w-[33rem] flex-col px-5 lg:px-12"
        }
      >
        {children}
      </div>
    </div>
  );
}
