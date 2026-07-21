import Link from "next/link";

import { cn } from "@/app/lib/utils";

/*
 * Landing CTAs. `TryDemoCTA` is a PLAIN full-navigation <a> to GET /api/try-demo
 * (never next/link — a prefetch would flip the sandbox cookie + redirect on hover;
 * the route sets the seeded-demo cookie then lands on /today). Primary fill is
 * `bg-ink-1` — never amber (invariant #4 reserves --energy for earned XP).
 */
const PRIMARY = "inline-flex min-h-11 items-center justify-center rounded-chip bg-ink-1 px-5 font-ui text-body text-canvas transition-opacity duration-[var(--t-base)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const GHOST = "inline-flex min-h-11 items-center justify-center rounded-chip border border-line px-5 font-ui text-body text-ink-1 transition-colors duration-[var(--t-base)] hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TryDemoCTA({ label = "Try the demo →", className }: { label?: string; className?: string }) {
  return (
    <a href="/api/try-demo" className={cn(PRIMARY, className)}>
      {label}
    </a>
  );
}

export function WaitlistCTA({ label = "Join the waitlist", className }: { label?: string; className?: string }) {
  return (
    <Link href="/waitlist" className={cn(GHOST, className)}>
      {label}
    </Link>
  );
}
