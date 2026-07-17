import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/app/lib/utils";

type Variant = "primary" | "ghost" | "quiet";

const VARIANTS: Record<Variant, string> = {
  // High-contrast neutral fill — never amber (invariant #4 reserves --energy).
  primary: "bg-ink-1 text-canvas",
  ghost: "border border-line text-ink-1",
  quiet: "text-ink-2",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-chip px-4 py-2 font-ui text-body transition-colors duration-[var(--t-base)] disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
