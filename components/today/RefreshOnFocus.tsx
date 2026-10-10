"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DEBOUNCE_MS = 500;

/*
 * Re-reads the server-rendered Today (plan spine + every lens body) when the tab becomes
 * visible again or the window regains focus — so an entry committed elsewhere (e.g. the
 * ChatGPT plugin) appears without a manual reload. Debounced: a visibilitychange + focus
 * pair fires one refresh. Renders nothing.
 */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, DEBOUNCE_MS);
    };
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("focus", schedule);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("focus", schedule);
    };
  }, [router]);
  return null;
}
