import type { ReactNode } from "react";

/*
 * A stat cluster item. `tone="energy"` is amber and is one of the ONLY surfaces
 * allowed to render `--energy` (invariant #4 / DESIGN §4: XP / streak / level-up) —
 * so it must be used only when the value is genuinely EARNED. `tone="muted"` renders
 * a base/zero value in `--ink-3`, keeping amber meaningful.
 */
export function StatPill({
  icon,
  children,
  tone = "energy",
  onArt = false,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "energy" | "muted";
  /** When the pill sits over an ArtFrame scrim band, the muted tone uses the light
   *  on-art ink so it reads on the dark-biased scrim. Amber (`energy`) is unchanged
   *  regardless — it is earned XP/streak/level and must never be recolored (§4). */
  onArt?: boolean;
}) {
  const mutedClass = onArt ? "on-art-dim" : "text-ink-3";
  return (
    <span
      className={`inline-flex items-center gap-1 font-display text-caption tabular-nums ${tone === "energy" ? "text-energy" : mutedClass}`}
    >
      {icon}
      {children}
    </span>
  );
}
