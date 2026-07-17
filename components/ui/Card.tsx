import type { HTMLAttributes } from "react";

import { cn } from "@/app/lib/utils";

/** Resting card surface. `--elev-card` is `none` in Bone (the 1px line carries the lift). */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-line bg-card p-5 shadow-[var(--elev-card)]", className)}
      {...props}
    />
  );
}
