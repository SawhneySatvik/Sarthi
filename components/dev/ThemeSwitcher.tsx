"use client";

import { Palette } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

/*
 * Temporary dev-only theme switcher (SAR-005, D-C / P0). Cycles all six
 * theme-modes live, persisting to localStorage (read pre-paint in the root layout).
 * The current theme lives on <html> (an external system set before hydration), so
 * it is read via useSyncExternalStore — server snapshot = the Ember-Dark default,
 * client snapshot = the actual attributes — which avoids a hydration mismatch and
 * the setState-in-effect anti-pattern. Relocates into Settings later (SAR-018).
 */
const COMBOS = [
  ["ember", "dark"],
  ["ember", "light"],
  ["bone", "dark"],
  ["bone", "light"],
  ["moss", "dark"],
  ["moss", "light"],
] as const;

let listeners: Array<() => void> = [];

function subscribe(onChange: () => void): () => void {
  listeners.push(onChange);
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function readSnapshot(): string {
  const el = document.documentElement;
  return `${el.getAttribute("data-theme") ?? "ember"}|${el.getAttribute("data-mode") ?? "dark"}`;
}

function serverSnapshot(): string {
  return "ember|dark";
}

export function ThemeSwitcher() {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot);
  const [theme, mode] = snapshot.split("|");

  const cycle = useCallback(() => {
    const el = document.documentElement;
    const current = `${el.getAttribute("data-theme") ?? "ember"}|${el.getAttribute("data-mode") ?? "dark"}`;
    const index = COMBOS.findIndex(([t, m]) => `${t}|${m}` === current);
    const [nextTheme, nextMode] = COMBOS[(index + 1) % COMBOS.length];
    el.setAttribute("data-theme", nextTheme);
    el.setAttribute("data-mode", nextMode);
    try {
      localStorage.setItem("sarthi-theme", JSON.stringify({ theme: nextTheme, mode: nextMode }));
    } catch {
      /* private-mode / unavailable storage — the visual cycle still works */
    }
    emit();
  }, []);

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${theme} ${mode}. Tap to cycle (dev).`}
      className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-chip border border-line bg-raised px-3 py-1.5 font-ui text-caption text-ink-2 shadow-[var(--elev-card)]"
    >
      <Palette size={14} strokeWidth={1.5} aria-hidden />
      <span className="capitalize">
        {theme} {mode}
      </span>
    </button>
  );
}
