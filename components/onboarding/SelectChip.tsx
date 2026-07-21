"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/app/lib/utils";

/*
 * SelectChip — SAR-012 Pass 1. The onboarding answer chip (§2/§11): ≥44px touch target,
 * single-column-friendly, tokens only. Active = neutral ink fill (never amber — invariant
 * #4 reserves `--energy` for the CORE hairline + the Pass-2 earned CTA).
 */
export function SelectChip({
  active = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "min-h-[44px] rounded-chip border px-4 py-2 font-ui text-body transition-colors duration-[var(--t-fast)]",
        // Unselected carries an OPAQUE `bg-card` surface (not a transparent border) so it stays
        // AA on BOTH the full-bleed CORE backdrop (UIE-5) and the DETAIL phase's plain canvas —
        // normal inks over a solid chip work in every theme-mode; on-art can't (shared with E).
        active ? "border-transparent bg-ink-1 text-canvas" : "border-line bg-card text-ink-2",
        className,
      )}
      {...props}
    />
  );
}
