import type { ReactNode } from "react";

/*
 * The amber stat cluster item (Day N of M · streak · level). This is one of the
 * ONLY surfaces allowed to render `--energy` (invariant #4 / DESIGN.md §4): if
 * amber is on screen, the user earned it. Display face + tabular figures.
 */
export function StatPill({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-display text-caption tabular-nums text-energy">
      {icon}
      {children}
    </span>
  );
}
