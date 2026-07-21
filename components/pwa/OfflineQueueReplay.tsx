"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { offlineQueueEnabled } from "@/app/lib/offline/flag";
import { replayCaptureQueue } from "@/app/lib/offline/capture-queue";

/*
 * OfflineQueueReplay (T10/PL-3) — drains the capture mutation queue on reconnect.
 *
 * Renders nothing. Mounts ONLY when NEXT_PUBLIC_ENABLE_OFFLINE_QUEUE === "1"; flag-off the
 * effect returns immediately and no IndexedDB/queue code runs. On the `online` event (and
 * once on mount, in case we launched already-online with a queue), it replays every pending
 * commit/undo AT MOST ONCE (see queue.ts) then `router.refresh()` so freshly-written entries
 * appear — the same server-render + refresh path F3 uses. A Background Sync `postMessage`
 * from the service worker is an additional trigger where supported.
 */
export function OfflineQueueReplay() {
  const router = useRouter();

  useEffect(() => {
    if (!offlineQueueEnabled()) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    let draining = false;

    async function drain() {
      if (draining) return;
      draining = true;
      try {
        const results = await replayCaptureQueue();
        if (!cancelled && results.some((r) => r.acked)) {
          router.refresh();
        }
      } finally {
        draining = false;
      }
    }

    // Attempt once on mount (queue may survive a reload), then on every reconnect.
    if (navigator.onLine !== false) void drain();
    const onOnline = () => void drain();
    window.addEventListener("online", onOnline);

    // Service-worker Background Sync nudge (progressive enhancement).
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "sarthi-replay-queue") void drain();
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
