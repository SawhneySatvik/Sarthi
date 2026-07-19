"use client";

import { Mic, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import type { FillQuestionKey } from "@/core/onboarding";

/*
 * VoiceFillButton — SAR-012 Pass 1 (D-D). The always-present mic affordance (§2), a
 * peer of the capture bar's hold-to-talk. Real audio recording is SAR-013; here it opens
 * a "say it or type it" input whose text posts to /api/onboarding/fill (fast-tier parse,
 * keyless fake). The parsed fields are shown for EXPLICIT confirmation before they enter
 * the draft ("user confirms", §2); a failure fills nothing and pulses the chips (§10).
 */
type Mode = "idle" | "input" | "loading" | "confirm" | "error";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  return String(value);
}

// Human-readable labels for fill field keys, so the confirm card never surfaces a raw dev
// key (e.g. "displayName" → "Name"). Unknown keys are humanised from camelCase as a fallback
// so nothing raw ever leaks.
const FIELD_LABELS: Record<string, string> = {
  displayName: "Name",
};

function fieldLabel(key: string): string {
  const mapped = FIELD_LABELS[key];
  if (mapped) return mapped;
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function VoiceFillButton({
  questionKey,
  onFilled,
  onUnparseable,
}: {
  questionKey: FillQuestionKey;
  onFilled: (fields: Record<string, unknown>) => void;
  onUnparseable?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState("");
  const [fields, setFields] = useState<Record<string, unknown>>({});

  function reset() {
    setMode("idle");
    setText("");
    setFields({});
  }

  async function submit() {
    if (text.trim().length === 0) return;
    setMode("loading");
    try {
      const res = await fetch("/api/onboarding/fill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionKey, text }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; fields?: Record<string, unknown> };
      if (!res.ok || !data.ok || !data.fields) {
        setMode("error");
        onUnparseable?.();
        return;
      }
      setFields(data.fields);
      setMode("confirm");
    } catch {
      setMode("error");
      onUnparseable?.();
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Say your answer"
        onClick={() => setMode(mode === "idle" ? "input" : "idle")}
        aria-expanded={mode !== "idle"}
        className="fixed bottom-6 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-chip bg-ink-1 text-canvas shadow-[var(--elev-card)]"
      >
        <Mic size={22} strokeWidth={1.5} aria-hidden />
      </button>

      {mode !== "idle" && (
        <div
          role="dialog"
          aria-label="Say it or type it"
          className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-[33rem] rounded-card border border-line bg-raised p-4 shadow-[var(--elev-card)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Say it or type it</p>
            <button type="button" aria-label="Close" onClick={reset} className="-mr-1 p-1 text-ink-2">
              <X size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          {(mode === "input" || mode === "loading") && (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. I'm 71 kilos, around 5'10&quot;"
                aria-label="Your spoken answer"
                rows={2}
                className="w-full resize-none rounded-input border border-line bg-canvas px-3 py-2 font-ui text-body text-ink-1 placeholder:text-ink-3 focus:outline-none"
              />
              <Button className="mt-3 w-full" onClick={submit} disabled={mode === "loading" || text.trim().length === 0}>
                {mode === "loading" ? "Reading…" : "Fill"}
              </Button>
            </>
          )}

          {mode === "confirm" && (
            <>
              <p className="font-coach text-body text-ink-2">Got this — use it?</p>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {Object.entries(fields).map(([key, value]) => (
                  <li key={key} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-ui text-caption tracking-wide text-ink-3">{fieldLabel(key)}</span>
                    <span className="font-ui text-body text-ink-1">{formatValue(value)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    onFilled(fields);
                    reset();
                  }}
                >
                  Use this
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setMode("input")}>
                  Try again
                </Button>
              </div>
            </>
          )}

          {mode === "error" && (
            <>
              <p className="font-coach text-body text-ink-1">Couldn’t catch that — tap a chip or type it instead.</p>
              <Button variant="ghost" className="mt-3 w-full" onClick={() => setMode("input")}>
                Try again
              </Button>
            </>
          )}
        </div>
      )}
    </>
  );
}
