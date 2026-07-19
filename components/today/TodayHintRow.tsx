"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

/*
 * TodayHintRow — SAR-012 Pass 3, Phase G (§9). The one-time, dismissible mic hint shown on
 * Day 1 only ("Hold the mic and just say your day."). Dismissal persists to a localStorage
 * flag so it never returns. Tokens only — neutral surface, no amber. Reading localStorage in
 * a mount effect (not during render) keeps SSR === the first client render.
 */
const HINT_KEY = "sarthi-today-hint-dismissed";

export function TodayHintRow({ dayOne }: { dayOne: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!dayOne) return;
    // One-time external-state read after mount (the sanctioned localStorage case).
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      if (localStorage.getItem(HINT_KEY) !== "1") setVisible(true);
    } catch {
      /* private-mode storage — the hint simply stays hidden */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dayOne]);

  if (!dayOne || !visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* private-mode storage — hide for this session regardless */
    }
    setVisible(false);
  };

  return (
    <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-card border border-line bg-raised px-4 py-3">
      <p className="font-coach text-body leading-[var(--leading-coach)] text-ink-2">
        Hold the mic and just say your day.
      </p>
      <button
        type="button"
        aria-label="Dismiss hint"
        onClick={dismiss}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-ink-3"
      >
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
