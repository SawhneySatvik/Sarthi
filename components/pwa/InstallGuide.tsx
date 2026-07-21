"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Download, Share, X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { isIosDevice, usePwaInstall } from "./usePwaInstall";

/*
 * InstallGuide — the bottom sheet the user can actually ACT on, shared by Today's InstallPrompt
 * and the Settings row. It replaces the old dead decorative Share chip (iOS cannot be told to
 * "Add to Home Screen" programmatically, so a fake button that does nothing is a UX trap).
 *
 * The sheet renders per usePwaInstall().state:
 *   • ios         → a numbered Share → "Add to Home Screen" → Add walkthrough (the honest path).
 *   • installable → a real Install button wired to the stashed beforeinstallprompt.
 *   • installed   → a calm "already on your home screen" done state.
 *   • unsupported → "open in Safari" (iOS non-Safari) or a graceful desktop line.
 *
 * Shape mirrors the coach adaptation dialog: role="dialog" aria-modal, scrim, bottom sheet on
 * mobile / centred on desktop, Escape + scrim/X to close, initial focus on Close. Motion mirrors
 * the CSS tokens as documented numbers (same convention as Reveal.tsx / capture motion.ts):
 * duration = --t-slow, ease = --ease-standard; under reduced motion it appears instantly. Tokens
 * only, neutral ink — installing is not an earned moment, so amber is untouched.
 */

const SHEET_SEC = 0.32; // mirrors --t-slow (320ms)
const EASE = [0.2, 0, 0, 1] as const; // mirrors --ease-standard

// A read-only external "store" for the client-only iOS-device sniff: getServerSnapshot pins the
// SSR + hydration render to `false`, then the client reads the real value — SSR-safe, and no
// setState-in-effect (the UA sniff never runs during the server render).
const SUBSCRIBE_NOOP = (): (() => void) => () => {};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip border border-line bg-card font-ui text-caption tabular-nums text-ink-2"
      >
        {n}
      </span>
      <span className="font-ui text-body leading-[var(--leading-coach)] text-ink-1">{children}</span>
    </li>
  );
}

function GuideBody({ state }: { state: ReturnType<typeof usePwaInstall>["state"] }) {
  const { promptInstall } = usePwaInstall();
  // iOS-device fork for the `unsupported` copy — defaults to the desktop line until the client
  // resolves it (see SUBSCRIBE_NOOP above).
  const iosDevice = useSyncExternalStore(SUBSCRIBE_NOOP, isIosDevice, () => false);

  if (state === "installed") {
    return (
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip border border-line bg-card text-ink-2"
        >
          <Check size={18} strokeWidth={1.5} />
        </span>
        <p className="font-coach text-body leading-[var(--leading-coach)] text-ink-1">
          Sarthi is already on your home screen.
        </p>
      </div>
    );
  }

  if (state === "installable") {
    return (
      <div>
        <p className="font-coach text-body leading-[var(--leading-coach)] text-ink-2">
          Install Sarthi for a faster, full-screen experience — it opens like any other app on your
          home screen.
        </p>
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-chip bg-ink-1 px-4 font-ui text-body text-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download size={16} strokeWidth={1.5} aria-hidden />
          Install Sarthi
        </button>
      </div>
    );
  }

  if (state === "ios") {
    return (
      <div>
        <p className="font-coach text-body leading-[var(--leading-coach)] text-ink-2">
          Add Sarthi to your home screen in three taps:
        </p>
        <ol className="mt-4 space-y-4">
          <Step n={1}>
            Tap the{" "}
            <span className="inline-flex translate-y-[0.15em] items-center px-0.5 text-ink-1">
              <Share size={16} strokeWidth={1.5} aria-label="Share" />
            </span>{" "}
            <strong className="font-ui text-ink-1">Share</strong> button in Safari&rsquo;s toolbar (at
            the bottom of the screen on iPhone).
          </Step>
          <Step n={2}>
            Scroll down and tap <strong className="font-ui text-ink-1">Add to Home Screen</strong>.
          </Step>
          <Step n={3}>
            Tap <strong className="font-ui text-ink-1">Add</strong> in the top corner.
          </Step>
        </ol>
      </div>
    );
  }

  // unsupported
  return (
    <p className="font-coach text-body leading-[var(--leading-coach)] text-ink-2">
      {iosDevice
        ? "Open this page in Safari to add Sarthi to your home screen — other iOS browsers can’t install web apps."
        : "On a phone? Open Sarthi in your browser and use its menu to add it to your home screen. On desktop, look for the install icon in the address bar."}
    </p>
  );
}

export function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = usePwaInstall();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Capture phase on window fires before any bubble-phase Escape listener (e.g. the parent
      // SettingsSheet when the guide is opened from there), so stopping propagation closes ONLY
      // the guide — the parent sheet stays open. Harmless on the Today path (no parent dialog).
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const heading =
    state === "installed"
      ? "You’re all set"
      : state === "installable"
        ? "Install Sarthi"
        : "Add to your home screen";

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end bg-[var(--scrim)] p-3 md:items-center md:justify-center"
      role="presentation"
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
        onClick={(event) => event.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: SHEET_SEC, ease: EASE }}
        className="w-full max-w-[30rem] overflow-hidden rounded-card border border-line bg-raised shadow-[var(--elev-card)]"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-4">
          <h2 id="install-guide-title" className="min-w-0 flex-1 font-display text-title text-ink-1">
            {heading}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-chip text-ink-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </header>
        <div className="px-4 py-5">
          <GuideBody state={state} />
        </div>
      </motion.section>
    </div>,
    document.body,
  );
}
