"use client";

import { useEffect } from "react";

/*
 * Registers the offline service worker — when NEXT_PUBLIC_ENABLE_SW === "1" (T3 app shell)
 * OR NEXT_PUBLIC_ENABLE_OFFLINE_QUEUE === "1" (T10 offline queue needs the SW for the
 * stale-while-revalidate read cache + Background Sync). Both flags are left UNSET on the
 * production demo, so the judged deploy stays SW-free until a deliberate go.
 *
 * The offline-queue flag is threaded to the SW via the registration URL query
 * (`/sw.js?offlineQueue=1`) — the SW reads `self.location.search` to decide whether to turn
 * on stale-while-revalidate. With that flag off, the URL is exactly `/sw.js` and the SW
 * behaves as T3 shipped (network-first navigations). Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    const swEnabled = process.env.NEXT_PUBLIC_ENABLE_SW === "1";
    const offlineQueue = process.env.NEXT_PUBLIC_ENABLE_OFFLINE_QUEUE === "1";
    if (!swEnabled && !offlineQueue) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const url = offlineQueue ? "/sw.js?offlineQueue=1" : "/sw.js";
    navigator.serviceWorker.register(url).catch(() => {});
  }, []);
  return null;
}
