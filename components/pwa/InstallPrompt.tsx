"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { InstallGuide } from "./InstallGuide";
import { usePwaInstall } from "./usePwaInstall";

/*
 * InstallPrompt — the dismissible "Add Sarthi to your home screen" affordance on Today (T3, FLOWS G).
 *
 * INLINE, NOT AN OVERLAY: renders in Today's normal content flow (mirroring TodayHintRow), so it can
 * never sit on top of the header gear or the capture bar — the demo path is never blocked.
 *
 * Install truth comes from the shared usePwaInstall hook (one module-level `beforeinstallprompt`
 * capture, shared with the Settings row). Two paths:
 *   • installable (Chromium) → a real "Add" button that fires the stashed prompt().
 *   • ios (Safari)           → iOS never fires the event, and iOS cannot be told to install
 *                              programmatically, so the card is a real button that OPENS InstallGuide
 *                              (the honest Share → "Add to Home Screen" walkthrough). No dead chip.
 * When installed / unsupported it renders nothing.
 *
 * Dismissal persists to localStorage so it never nags (this is Today-only — Settings ignores it).
 * The iOS card reveals after a short beat so it never competes with first paint / the coach's line.
 * localStorage is read in a mount effect, so SSR === the first client render.
 */

const DISMISS_KEY = "sarthi-pwa-install-dismissed";
const IOS_REVEAL_MS = 2500;

// Read-only external "store" for the localStorage dismissal flag: getServerSnapshot pins SSR +
// hydration to `true` (hidden), so the server render === the first client render; after hydration
// the client reads the real flag. This keeps the read SSR-safe without a setState-in-effect.
const SUBSCRIBE_NOOP = (): (() => void) => () => {};

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* private-mode storage — dismissed for this session regardless */
  }
}

export function InstallPrompt() {
  const { state, promptInstall } = usePwaInstall();
  const storedDismissed = useSyncExternalStore(SUBSCRIBE_NOOP, isDismissed, () => true);
  const [locallyDismissed, setLocallyDismissed] = useState(false);
  const [iosReady, setIosReady] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const dismissed = storedDismissed || locallyDismissed;

  // Reveal the iOS card after a short beat (Chromium's "Add" appears immediately when the event lands).
  useEffect(() => {
    if (state !== "ios") return;
    const timer = setTimeout(() => setIosReady(true), IOS_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const dismiss = () => {
    persistDismissed();
    setLocallyDismissed(true);
  };

  const install = async () => {
    await promptInstall();
  };

  const showAdd = state === "installable";
  const showIos = state === "ios" && iosReady;
  const visible = !dismissed && (showAdd || showIos);

  if (!visible) return null;

  return (
    <>
      <div className="mx-4 mb-2 flex items-center gap-3 rounded-card border border-line bg-raised px-4 py-3">
        {showIos ? (
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            aria-haspopup="dialog"
            className="-my-3 flex min-w-0 flex-1 items-center gap-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip border border-line bg-card text-ink-2"
            >
              <Share size={18} strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-ui text-body text-ink-1">Add Sarthi to your home screen</span>
              <span className="mt-0.5 block font-ui text-caption text-ink-2">
                Tap to see how — it takes three taps in Safari.
              </span>
            </span>
          </button>
        ) : (
          <>
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip border border-line bg-card text-ink-2"
            >
              <Download size={18} strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-ui text-body text-ink-1">Add Sarthi to your home screen</p>
              <p className="mt-0.5 font-ui text-caption text-ink-2">
                Install for a faster, full-screen experience.
              </p>
            </div>
            <button
              type="button"
              onClick={install}
              className="inline-flex min-h-11 shrink-0 items-center rounded-chip bg-ink-1 px-4 font-ui text-caption text-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Add
            </button>
          </>
        )}
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <InstallGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
