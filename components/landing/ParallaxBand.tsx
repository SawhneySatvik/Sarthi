"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef, useState } from "react";

import { ART } from "@/components/art/registry";

/*
 * The one edge-to-edge art moment (DESIGN §8 — atmosphere lives in the emotional bands). A
 * full-bleed dusk scene with SUBTLE scroll parallax (framer useScroll/useTransform, an existing
 * dep — no hand-rolled listener); reduced-motion pins it static. It carries a single Fraunces
 * coach line on the scrim (Fraunces on art only). Its own fallback plate mirrors ArtFrame's
 * de-slop law (D-025): a tinted underlay + grain + scrim + onError, so a slow/missing asset
 * reveals an intentional plate, never a naked rectangle. Inline styles reference ONLY var()
 * tokens (same pattern as ArtFrame) — invariant #4 holds.
 */
const ART_KEY = "today.header.dusk" as const;

export function ParallaxBand() {
  const reduce = useReducedMotion();
  const art = ART[ART_KEY];
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yShift = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);
  const y = reduce ? undefined : yShift;

  return (
    <section ref={ref} className="full-bleed relative z-10 my-16 lg:my-24">
      <div className="relative min-h-[360px] overflow-hidden border-y border-line" style={{ height: "58vh", maxHeight: "560px" }}>
        {/* Always-painted plate (D-025): a tinted underlay + grain beneath the image. */}
        <div
          aria-hidden
          className="art-grain absolute inset-0"
          style={{ background: "linear-gradient(160deg, var(--bg-raised), var(--bg-card))" }}
        />
        {!failed && (
          <motion.div style={{ y }} className="absolute inset-[-12%]">
            <Image
              src={art.src}
              alt={art.alt}
              fill
              sizes="100vw"
              onError={() => setFailed(true)}
              className="object-cover"
            />
          </motion.div>
        )}
        {/* Per-mode dark-biased scrim so light on-art type passes AA in both Bone modes. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 0%, transparent 28%, var(--scrim-art) 100%)" }}
        />
        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-start justify-end gap-4 px-6 py-10 lg:py-14">
          <p className="on-art-dim font-ui text-caption uppercase tracking-[0.22em]">One line, every evening</p>
          <p className="on-art max-w-2xl font-coach text-display leading-[var(--leading-coach)]">
            &ldquo;You showed up today. Same time tomorrow — I&rsquo;ll have the plan ready.&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}
