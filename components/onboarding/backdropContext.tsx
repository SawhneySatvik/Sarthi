"use client";

import { createContext, useContext } from "react";

import type { ArtKey } from "@/components/art/registry";

/*
 * UIE-5 — the onboarding backdrop bus. The full-bleed painterly layer lives in the
 * layout (OUTSIDE the ~528px question column, so the art is genuinely full-viewport and
 * survives the desktop split), but the CURRENT per-phase art key is owned by the client
 * phase machine (OnboardingFlow). This tiny context threads that key up to the layout's
 * backdrop layer without pulling any flow logic into the layout. Presentation only.
 */
export type OnboardingBackdropValue = {
  artKey: ArtKey | null;
  setArtKey: (key: ArtKey | null) => void;
};

export const OnboardingBackdropContext = createContext<OnboardingBackdropValue>({
  artKey: null,
  setArtKey: () => {},
});

export function useOnboardingBackdrop(): OnboardingBackdropValue {
  return useContext(OnboardingBackdropContext);
}
