/**
 * app/lib/fonts.ts — SAR-005 (D-B). Fonts via next/font (self-hosted at build →
 * no runtime network, keyless). Inter = UI/body, Fraunces = coach voice, Sora =
 * display (the shipped fallback for Clash Display, per DESIGN.md §3; Clash self-host
 * is a later polish ticket, OQ-2). Each exposes a CSS variable consumed by the token
 * layer (`--font-ui-family` / `--font-coach-family` / `--font-display-family`).
 */
import { Fraunces, Inter, Sora } from "next/font/google";

export const fontUi = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui-family",
});

export const fontCoach = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-coach-family",
});

export const fontDisplay = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-family",
});

/** The class list applied to <html> so all three font variables are in scope. */
export const fontVariables = `${fontUi.variable} ${fontCoach.variable} ${fontDisplay.variable}`;
