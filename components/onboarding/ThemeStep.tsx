"use client";

import { useState } from "react";

import { cn } from "@/app/lib/utils";
import { mirrorDurableState } from "@/app/lib/offline/durable-state";
import { Button } from "@/components/ui/Button";

import { SelectChip } from "./SelectChip";

type ThemeId = "ember" | "bone" | "moss";
type ModeId = "light" | "dark" | "system";

const THEMES: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: "ember", label: "Ember" },
  { id: "bone", label: "Bone" },
  { id: "moss", label: "Moss" },
];

const MODES: ReadonlyArray<{ id: ModeId; label: string }> = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

function resolveMode(mode: ModeId): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

function applyTheme(theme: ThemeId, mode: ModeId): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-theme", theme);
  el.setAttribute("data-mode", resolveMode(mode));
  try {
    localStorage.setItem("sarthi-theme", JSON.stringify({ theme, mode }));
  } catch {
    /* private-mode storage — the live switch still applies for this session */
  }
  // Additive durable mirror (T10, flag-gated); localStorage stays the source of truth.
  void mirrorDurableState("sarthi-theme", { theme, mode });
}

function persistThemeToProfile(theme: ThemeId, mode: ModeId): void {
  // A nicety, not the source of truth (the pre-paint reads localStorage): fire-and-forget so
  // navigation is never blocked on it. The route re-validates and patches the typed column.
  void fetch("/api/onboarding/detail", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ section: "theme", theme, themeMode: mode }),
  }).catch(() => {
    /* the persisted localStorage theme already holds; the profile column is best-effort */
  });
}

function ThemePreview({
  theme,
  mode,
  selected,
  onSelect,
}: {
  theme: ThemeId;
  mode: ModeId;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    // The selected RING lives on an OUTER wrapper that carries NO data-theme/data-mode, so
    // `ring-ink-1` resolves to the APP's current mode — the indicator stays high-contrast in
    // BOTH light and dark. (The inner button's own tokens resolve to the PREVIEW mode, which is
    // why the previous `border-ink-1` on the button vanished on a dark canvas.) Not amber:
    // choosing a palette is a preference, not an earned moment.
    <div
      className={cn(
        "rounded-card",
        selected && "ring-2 ring-ink-1 ring-offset-2 ring-offset-canvas",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        data-theme={theme}
        data-mode={resolveMode(mode)}
        aria-pressed={selected}
        aria-label={`${theme} theme`}
        className="flex w-full flex-col gap-2 rounded-card border border-line bg-canvas p-3 transition-colors"
      >
        <div className="rounded-input bg-card p-2">
          <div className="h-2 w-2/3 rounded-full bg-ink-1" />
          <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-ink-3" />
        </div>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-health" />
          <span className="h-2.5 w-2.5 rounded-full bg-money" />
          <span className="h-2.5 w-2.5 rounded-full bg-habits" />
          <span className="h-2.5 w-2.5 rounded-full bg-skills" />
        </div>
        <span className="font-ui text-caption capitalize text-ink-2">{theme}</span>
      </button>
    </div>
  );
}

export function ThemeStep({ onDone }: { onDone: () => void }) {
  const [theme, setTheme] = useState<ThemeId>("bone");
  const [mode, setMode] = useState<ModeId>("system");

  const selectTheme = (next: ThemeId) => {
    setTheme(next);
    applyTheme(next, mode);
  };
  const selectMode = (next: ModeId) => {
    setMode(next);
    applyTheme(theme, next);
  };

  return (
    <div className="flex flex-1 flex-col pb-10">
      <div className="flex-1">
        <h1 className="font-display text-display text-ink-1">Make it yours.</h1>
        <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
          Pick a palette — you can change it any time.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {THEMES.map((option) => (
            <ThemePreview
              key={option.id}
              theme={option.id}
              mode={mode}
              selected={theme === option.id}
              onSelect={() => selectTheme(option.id)}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {MODES.map((option) => (
            <SelectChip key={option.id} active={mode === option.id} onClick={() => selectMode(option.id)}>
              {option.label}
            </SelectChip>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Button
          className="min-h-11 flex-1"
          onClick={() => {
            applyTheme(theme, mode);
            persistThemeToProfile(theme, mode);
            onDone();
          }}
        >
          Use this
        </Button>
        <button
          type="button"
          onClick={() => {
            applyTheme("bone", "system");
            onDone();
          }}
          className="min-h-11 px-4 py-3 font-ui text-body text-ink-2"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
