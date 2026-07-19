import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/app/lib/utils";

/** Pill selector (domain switcher, filters). Active = filled line/raised; inactive = quiet. */
export function Chip({
  active = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-chip border px-3 py-1.5 font-ui text-caption transition-colors duration-[var(--t-fast)]",
        active ? "border-line bg-raised text-ink-1" : "border-transparent text-ink-2",
        className,
      )}
      {...props}
    />
  );
}
