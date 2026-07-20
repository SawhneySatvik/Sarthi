import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/app/lib/utils";

/*
 * A navigation CTA styled exactly like components/ui/Button, but rendered as a real
 * anchor for correct navigation semantics. Token-only classes; the primary fill is the
 * high-contrast neutral (bg-ink-1) — NEVER amber (invariant #4 reserves --energy for earned
 * XP/streak/level-up). Hit target ≥44px (min-h-11) per DESIGN §9.
 *
 * `native` swaps `next/link` for a plain full-navigation `<a>`. This is load-bearing (not a
 * style choice) for the cookie-setting action routes (`/api/try-demo`, `/api/start-fresh`):
 * a `next/link` would PREFETCH those endpoints on hover/viewport and fire their cookie-set +
 * redirect prematurely. A full navigation also lets the browser apply the `Set-Cookie` and
 * follow the redirect reliably.
 *
 * `onArt` is for CTAs that sit OVER an ArtFrame's dark scrim (the closing summit) rather than
 * on the plain canvas (the hero). The on-canvas variants use mode-dependent inks that sink
 * into the always-dark scrim in Bone light; the on-art variants use the mode-invariant on-art
 * inks (`--ink-on-art-*`) + the always-dark `--scrim-art` as label, so a light-fill primary and
 * a light-hairline ghost read legibly over the scrim in BOTH modes. Tokens-only.
 */
type Variant = "primary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink-1 text-canvas",
  ghost: "border border-line text-ink-1",
};

const ON_ART_VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--ink-on-art-1)] text-[var(--scrim-art)]",
  ghost: "border border-[var(--ink-on-art-2)] text-[var(--ink-on-art-1)]",
};

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-chip px-5 py-3 font-ui text-body transition-colors duration-[var(--t-base)]";

export function CtaLink({
  variant = "primary",
  className,
  native = false,
  onArt = false,
  href,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; native?: boolean; onArt?: boolean }) {
  const classes = cn(BASE, (onArt ? ON_ART_VARIANTS : VARIANTS)[variant], className);

  if (native) {
    return (
      <a href={typeof href === "string" ? href : String(href)} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
