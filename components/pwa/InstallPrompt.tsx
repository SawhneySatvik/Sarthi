"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/*
 * InstallPrompt — the dismissible "Add Sarthi to your home screen" affordance (T3, FLOWS G).
 *
 * INLINE, NOT AN OVERLAY: this renders in Today's normal content flow (mirroring TodayHintRow),
 * so it can never sit on top of the header's Settings gear or the bottom capture bar — the demo
 * path is never blocked. Two paths:
 *   • Chromium: capture `beforeinstallprompt` (preventDefault + stash), show an "Add" button that
 *     calls the stashed event's prompt(). This only fires when the SW + manifest make the app
 *     installable, so with the SW flag OFF it simply never appears — the graceful no-op.
 *   • iOS Safari: never fires `beforeinstallprompt`, so we detect it and show the manual
 *     Share → "Add to Home Screen" instruction instead.
 * Dismissal (and a completed install) persist to localStorage so it never nags. Tokens only,
 * neutral ink (install is not an "earned" moment — no amber). Reads UA/localStorage in a mount
 * effect, not during render, so SSR === the first client render.
 */

const DISMISS_KEY = "sarthi-pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "hidden" | "prompt" | "ios";

function alreadyInstalled(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const iOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ masquerades as desktop Safari; touch points disambiguate it.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /webkit/i.test(ua);
  // Chrome/Firefox/Edge/Opera on iOS all use WebKit but can't "Add to Home Screen".
  const otherBrowser = /crios|fxios|edgios|opios|mercury/i.test(ua);
  return iOS && webkit && !otherBrowser;
}

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
  const [mode, setMode] = useState<Mode>("hidden");
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (alreadyInstalled() || isDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      // Stop Chromium's default mini-infobar; we present our own tokenized affordance.
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      setMode("prompt");
    };
    const onInstalled = () => {
      persistDismissed();
      deferredRef.current = null;
      setMode("hidden");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS has no beforeinstallprompt — reveal the manual instruction after a short beat so it
    // never competes with first paint / the coach's opening line.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIosSafari()) {
      iosTimer = setTimeout(() => setMode((current) => (current === "hidden" ? "ios" : current)), 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    persistDismissed();
    setMode("hidden");
  };

  const install = async () => {
    const event = deferredRef.current;
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      /* user gesture races / unsupported — fall through to hiding */
    }
    deferredRef.current = null;
    // `appinstalled` persists the dismissal on success; a decline just hides for now (the
    // browser controls whether beforeinstallprompt fires again later).
    setMode("hidden");
  };

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-card border border-line bg-raised px-4 py-3">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip border border-line bg-card text-ink-2"
      >
        {mode === "ios" ? <Share size={18} strokeWidth={1.5} /> : <Download size={18} strokeWidth={1.5} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ui text-body text-ink-1">Add Sarthi to your home screen</p>
        <p className="mt-0.5 font-ui text-caption text-ink-2">
          {mode === "ios"
            ? "Tap the Share button, then “Add to Home Screen.”"
            : "Install for a faster, full-screen experience."}
        </p>
      </div>
      {mode === "prompt" ? (
        <button
          type="button"
          onClick={install}
          className="inline-flex min-h-11 shrink-0 items-center rounded-chip bg-ink-1 px-4 font-ui text-caption text-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Add
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
