import type { Metadata } from "next";

import { Closing } from "@/components/landing/Closing";
import { Coach } from "@/components/landing/Coach";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Lenses } from "@/components/landing/Lenses";
import { Moat } from "@/components/landing/Moat";
import { Pricing } from "@/components/landing/Pricing";

/*
 * `/` — the public landing (the front door). A static server component: no session read,
 * no redirect. Visitors enter the app via "Try the demo" (GET /api/try-demo → seeded
 * /today) or "Join the waitlist". Editorial + art-led; every bit of depth is the
 * painterly art, whitespace, and type — no synthetic gradient atmosphere.
 */
export const metadata: Metadata = {
  title: "Sarthi — one sentence, your whole life sorted",
  description:
    "A voice-and-photo life coach. Speak one messy sentence and Sarthi files it across Health, Money, Habits and Skills at once — nothing estimated is written until you confirm.",
};

export default function Home() {
  return (
    <main className="bg-canvas">
      <Hero />
      <Moat />
      <Lenses />
      <Coach />
      <Pricing />
      <Closing />
      <Footer />
    </main>
  );
}
