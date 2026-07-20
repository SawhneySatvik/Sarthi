import Link from "next/link";

import { CtaLink } from "./CtaLink";

/** Calm top nav: wordmark left, one quiet link + one ghost CTA right. Static (not sticky). */
export function LandingNav() {
  return (
    <header className="w-full border-b border-line">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-title tracking-tight text-ink-1">
          Sarthi
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="/api/start-fresh" className="hidden px-3 py-2 font-ui text-body text-ink-2 transition-colors duration-[var(--t-base)] hover:text-ink-1 sm:inline-flex">
            Start fresh
          </a>
          <CtaLink href="/today" variant="ghost" className="px-4 py-2">
            Enter app
          </CtaLink>
        </div>
      </nav>
    </header>
  );
}
