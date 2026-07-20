"use client";

import { useEffect } from "react";

/*
 * Registers the offline service worker — but ONLY when NEXT_PUBLIC_ENABLE_SW === "1".
 * That flag is left UNSET on the production demo, so the judged deploy stays SW-free
 * until a deliberate go (submission guardrail). Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_SW !== "1") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
