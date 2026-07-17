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
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "energy" | "muted";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-display text-caption tabular-nums ${tone === "energy" ? "text-energy" : "text-ink-3"}`}
    >
      {icon}
      {children}
    </span>
  );
}
