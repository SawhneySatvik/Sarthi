"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * usePwaInstall — ONE source of truth for "can this browser add Sarthi to the home screen, and
 * how?", shared by the Today prompt (InstallPrompt) and the Settings row (InstallGuide).
 *
 * Why a module-level store (mirrors settings/byok + runtimeOverride): the `beforeinstallprompt`
 * event fires ONCE, early, and only Chromium fires it at all. A component that mounts late (the
 * Settings sheet opens minutes after load) would miss it entirely if each consumer added its own
 * listener. So we wire the listeners at module scope, the instant this client module evaluates,
 * and STASH the event globally. Consumers subscribe via useSyncExternalStore and always see the
 * current, shared truth — no races, no double-wiring.
 *
 * Dismissal (the "don't nag me on Today" flag) is deliberately NOT here — it is a Today-only
 * concern kept in InstallPrompt; Settings must surface install regardless of it.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * - `installed`   — running as an installed app (standalone / navigator.standalone).
 * - `installable` — Chromium/Android stashed a `beforeinstallprompt`; a real Install button works.
 * - `ios`         — iOS Safari: no event ever fires, so we show the manual Share walkthrough.
 * - `unsupported` — iOS in a non-Safari browser, or desktop with no prompt event: nothing to do.
 */
export type PwaInstallState = "installed" | "installable" | "ios" | "unsupported";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedFlag = false;
let wired = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Wire the one-shot capture + appinstalled listeners exactly once, on the client only. */
function ensureWired(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Stop Chromium's default mini-infobar; we present our own tokenized affordance instead.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    // The stashed event is single-use and now spent; flip to the done state.
    deferredPrompt = null;
    installedFlag = true;
    emit();
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True on an iOS device in a WebKit browser that can actually "Add to Home Screen" — Safari.
 *  iPadOS 13+ masquerades as desktop Safari, so touch points disambiguate it; Chrome/Firefox/
 *  Edge/Opera on iOS all use WebKit but cannot install, so they are excluded. */
function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const iOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /webkit/i.test(ua);
  const otherBrowser = /crios|fxios|edgios|opios|mercury/i.test(ua);
  return iOS && webkit && !otherBrowser;
}

/** True on any iOS device regardless of browser — lets the guide's `unsupported` copy fork
 *  between "open in Safari" (iOS non-Safari) and the desktop line, without re-sniffing UA. */
export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function computeState(): PwaInstallState {
  if (typeof window === "undefined") return "unsupported";
  if (installedFlag || isStandalone()) return "installed";
  if (deferredPrompt) return "installable";
  if (isIosSafari()) return "ios";
  return "unsupported";
}

function subscribe(onChange: () => void): () => void {
  ensureWired();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

// getSnapshot returns a primitive string derived from current globals — stable across calls
// (Object.is on strings), so no render loop. getServerSnapshot pins the SSR + hydration render
// to a neutral value so consumers can read `state` during render without a hydration mismatch.
const getSnapshot = (): PwaInstallState => computeState();
const getServerSnapshot = (): PwaInstallState => "unsupported";

// Evaluate on client bundle load — the earliest possible moment, so an early
// `beforeinstallprompt` is captured before any consumer subscribes.
ensureWired();

export function usePwaInstall(): { state: PwaInstallState; promptInstall: () => Promise<void> } {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      /* user-gesture race / unsupported — fall through and clear the spent event */
    }
    // `beforeinstallprompt` is single-use: whether accepted or dismissed, it is now spent.
    // (On accept, `appinstalled` also flips to `installed`.) Clearing avoids a false
    // `installable` lingering after the user declined.
    deferredPrompt = null;
    emit();
  }, []);

  return { state, promptInstall };
}
