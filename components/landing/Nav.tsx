import Link from "next/link";

import { Wordmark } from "./Wordmark";

/*
 * Nav — transparent, rendered inside the Hero's positioned container so it sits over
 * the hero art. Type uses the on-art inks (the hero carries a top legibility scrim).
 * "Try the demo" is a solid full-navigation <a> (GET /api/try-demo, never prefetched).
 */
export function Nav() {
  return (
    <div className="absolute inset-x-0 top-0 z-20">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
        <Link href="/" className="rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Wordmark className="on-art" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href="/api/try-demo"
            className="inline-flex min-h-11 items-center justify-center rounded-chip bg-ink-1 px-4 font-ui text-body text-canvas transition-opacity duration-[var(--t-base)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try the demo
          </a>
          <Link
            href="/waitlist"
            className="inline-flex min-h-11 items-center justify-center rounded-chip px-3 font-ui text-body on-art transition-opacity duration-[var(--t-base)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Waitlist
          </Link>
        </div>
      </nav>
    </div>
  );
}
