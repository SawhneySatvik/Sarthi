import Link from "next/link";

/** Minimal footer: wordmark, tagline, and the two live routes. No dead links. */
export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-display text-title text-ink-1">Sarthi</span>
          <span className="font-ui text-caption text-ink-2">
            सारथी — the charioteer who steers the rider.
          </span>
          <span className="font-ui text-caption text-ink-3">
            A voice-and-photo life coach · built with Codex + GPT-5.6.
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/today" className="font-ui text-body text-ink-2 transition-colors duration-[var(--t-base)] hover:text-ink-1">
            Try the demo
          </Link>
          <Link href="/onboarding" className="font-ui text-body text-ink-2 transition-colors duration-[var(--t-base)] hover:text-ink-1">
            Start fresh
          </Link>
        </div>
      </div>
    </footer>
  );
}
