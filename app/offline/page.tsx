import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline — Sarthi" };

/*
 * The offline fallback (served by the service worker when a navigation fails with no
 * network). Static, self-contained, tokens-only.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <p className="font-coach text-display-xl text-ink-1">You&rsquo;re offline</p>
      <p className="max-w-sm font-ui text-body leading-relaxed text-ink-2">
        Sarthi needs a connection for this screen. Reconnect and it&rsquo;ll pick up right where you left
        off.
      </p>
    </main>
  );
}
