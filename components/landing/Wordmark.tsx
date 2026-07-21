import { cn } from "@/app/lib/utils";

/*
 * Wordmark — `सारthi` set in the serif display voice (font-coach = Fraunces). The
 * Devanagari "सार" falls back to the platform serif; "thi" is Fraunces. Colour comes
 * from the caller (`text-ink-1` on paper, `on-art` over imagery) — never hardcoded.
 */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-coach text-title tracking-tight", className)}>सारthi</span>;
}
