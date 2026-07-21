"use client";

import { useEffect, useState } from "react";

import {
  getNotificationState,
  remindersEnabled,
  requestNotificationPermission,
  setRemindersEnabled,
  type NotificationState,
} from "./notifications";

/*
 * NotificationToggle — the opt-in "Enable reminders" switch for the Settings › COACH section
 * (T3). It NEVER auto-prompts: permission is requested only on this explicit tap. When granted,
 * it flips the reminders pref and dispatches `sarthi:reminders-changed` so the live scheduler
 * (components/pwa/LocalReminders) re-arms from the brief times T2 persists — no reload needed.
 *
 * Honest degrade: with notifications unsupported, permission blocked, or the service worker not
 * yet registered (the SW flag is OFF by default), the note says so rather than pretending a
 * reminder was scheduled that can never fire. Tokens only, neutral ink (not an earned moment).
 * This subtree renders only inside the Settings portal (opened on a user gesture), so reading
 * browser state in the lazy initializers is client-only and SSR-safe.
 */
export function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationState>(() => getNotificationState());
  const [enabled, setEnabled] = useState<boolean>(() => remindersEnabled());
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    // getRegistration() resolves undefined when no SW is registered (never `.ready`, which
    // would hang forever with the SW flag off).
    let active = true;
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => { if (active) setSwReady(Boolean(reg)); })
        .catch(() => {});
    }
    return () => { active = false; };
  }, []);

  const unsupported = permission === "unsupported";
  const on = enabled && permission === "granted";

  async function toggle() {
    if (unsupported) return;
    if (on) {
      setRemindersEnabled(false);
      setEnabled(false);
      window.dispatchEvent(new Event("sarthi:reminders-changed"));
      return;
    }
    let granted = permission === "granted";
    if (!granted) {
      const next = await requestNotificationPermission();
      setPermission(next);
      granted = next === "granted";
    }
    if (granted) {
      setRemindersEnabled(true);
      setEnabled(true);
      window.dispatchEvent(new Event("sarthi:reminders-changed"));
    }
    // Denied → leave off; the note explains how to unblock.
  }

  const note = unsupported
    ? "Not supported in this browser."
    : permission === "denied"
      ? "Blocked — allow notifications in your browser settings."
      : on && !swReady
        ? "On — reminders start delivering once notifications go live."
        : on
          ? "On — fires while Sarthi is open, at your brief times above."
          : "Fires local reminders at your brief times above.";

  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-line px-4">
      <div className="min-w-0 flex-1">
        <span className="font-ui text-body text-ink-1">Enable reminders</span>
        <p className="mt-0.5 font-ui text-caption text-ink-3">{note}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Enable reminders"
        disabled={unsupported}
        onClick={toggle}
        className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-chip focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      >
        <span
          className={`relative h-6 w-11 rounded-full border transition-colors duration-[var(--t-fast)] motion-reduce:transition-none ${on ? "border-ink-1 bg-ink-1" : "border-line bg-card"}`}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-canvas transition-[left] duration-[var(--t-fast)] motion-reduce:transition-none ${on ? "left-[1.625rem]" : "left-0.5"}`}
          />
        </span>
      </button>
    </div>
  );
}
