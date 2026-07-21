"use client";

import { useEffect } from "react";

import { scheduleLocalReminders } from "./notifications";

/*
 * LocalReminders — renders nothing; arms the timeout-based local reminder scheduler for the
 * whole app session (mounted in the (app) shell). It only READS state: scheduleLocalReminders
 * is a no-op unless reminders are already enabled AND permission was already granted, so this
 * NEVER prompts on load. Re-arms when Settings toggles reminders (custom event) so a change
 * takes effect without a reload. Fires only while a tab is open — the honest keyless limit.
 */
export function LocalReminders() {
  useEffect(() => {
    let cleanup = scheduleLocalReminders();
    const reschedule = () => {
      cleanup();
      cleanup = scheduleLocalReminders();
    };
    window.addEventListener("sarthi:reminders-changed", reschedule);
    return () => {
      window.removeEventListener("sarthi:reminders-changed", reschedule);
      cleanup();
    };
  }, []);
  return null;
}
