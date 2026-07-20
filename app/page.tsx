import type { Metadata } from "next";

import { CaptureMoment } from "@/components/landing/CaptureMoment";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { FourLenses } from "@/components/landing/FourLenses";
import { GlassBoxCoach } from "@/components/landing/GlassBoxCoach";
import { Hero } from "@/components/landing/Hero";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { ParallaxBand } from "@/components/landing/ParallaxBand";
import { Pricing } from "@/components/landing/Pricing";

/*
 * `/` is now the public landing (the blind redirect into the app is gone by design — a
 * visitor must see the story; returning users re-enter via the CTAs / nav "Enter app").
 * Fully static, keyless: no session, no DB, no API keys — renders on the fake stack.
 * Tokens-only, Bone house style; the whole page obeys DESIGN.md as an invariant.
 *
 * `.landing` scopes the cinematic atmosphere tokens (globals.css) — a dusk gradient-mesh of
 * the four domain hues + a soft vignette + grain, sitting BEHIND all content (z-index:-1 in
 * the isolated stacking context). Nothing here regresses the app themes or token parity.
 */
export const metadata: Metadata = {
  title: "Sarthi — your whole life, from one sentence",
  description:
    "A voice-and-photo life coach. Speak one messy line and Sarthi files it across Health, Money, Habits and Skills, then coaches you forward.",
};

export default function Home() {
  return (
    <main className="landing relative isolate min-h-screen overflow-x-clip bg-canvas text-ink-1">
      <div aria-hidden className="atmo-layer art-grain" />
      <div aria-hidden className="atmo-vignette" />

      <LandingNav />
      <Hero />
      <CaptureMoment />
      <ParallaxBand />
      <FourLenses />
      <GlassBoxCoach />
      <Pricing />
      <ClosingCta />
      <LandingFooter />
    </main>
  );
}
