"use client";

import { type ReactNode, useState } from "react";
import Image from "next/image";

import { ART, type ArtKey } from "./registry";

/** Responsive art surface with a visual-only failure fallback. It never changes data/actions. */
export function ArtFrame({ artKey, children, className = "", eager = false, ratio = "aspect-video" }: { artKey: ArtKey; children?: ReactNode; className?: string; eager?: boolean; ratio?: string }) {
  const [failed, setFailed] = useState(false);
  const art = ART[artKey];
  const accent = art.accent === "overall" ? "var(--bg-raised)" : `var(--dom-${art.accent})`;
  return (
    <div className={`art-frame relative isolate overflow-hidden rounded-card border border-line ${ratio} ${className}`}>
      {/* Always-painted underlay (D-052 / D-025): a domain-tinted gradient + grain sits
          BENEATH the image, so a slow / missing / remounting art asset reveals an
          intentional plate — never a blank rectangle (fixes the empty Tools Focus frame). */}
      <div aria-hidden className="art-grain absolute inset-0" style={{ background: `linear-gradient(145deg, ${accent}, var(--bg-card))` }} />
      {!failed && <Image src={art.src} alt={art.alt} fill sizes="(max-width: 768px) 100vw, 720px" priority={eager} onError={() => setFailed(true)} className="object-cover" />}
      {/* Per-mode dark-biased scrim: light on-art type passes AA regardless of theme mode. */}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_35%,var(--scrim-art)_100%)]" />
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
}
