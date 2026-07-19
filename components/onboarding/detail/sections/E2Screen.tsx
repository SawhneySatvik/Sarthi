"use client";

import { useState } from "react";

import type { OnboardingDetailInput } from "@/core/onboarding";

import { SectionShell } from "../SectionShell";

/*
 * E2 — Screen time (§7). A 1–10h+ slider stored as integer MINUTES (invariant #2), with the
 * Fraunces "no judgment — calibration" nudge. Save patches `screenTimeMinutes` and resolves
 * the `detail-screen-time` gap. Slider always carries a value, so Save is always enabled.
 */
const MIN = 60; // 1h
const MAX = 600; // 10h+
const STEP = 30;

function hoursLabel(minutes: number): string {
  const hours = minutes / 60;
  const whole = Math.floor(hours);
  const half = minutes % 60 === 30;
  const body = half ? `${whole}.5` : `${whole}`;
  return minutes >= MAX ? "10h+" : `${body}h`;
}

export function E2Screen({
  onSave,
  onSkip,
  saving,
}: {
  onSave: (payload: OnboardingDetailInput) => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const [minutes, setMinutes] = useState(180); // 3h default

  return (
    <SectionShell
      title="Screen time, honestly."
      subline="No judgment — calibration. It just tunes your habit targets."
      saving={saving}
      onSkip={onSkip}
      onSave={() => onSave({ section: "screen", screenTimeMinutes: minutes })}
    >
      <label className="flex flex-col gap-3">
        <span className="flex items-center justify-between font-ui text-caption uppercase tracking-wide text-ink-2">
          A normal day
          <span className="font-display text-title tabular-nums text-ink-1">{hoursLabel(minutes)}</span>
        </span>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
          aria-label="Daily screen time"
          className="w-full accent-[color:var(--ink-1)]"
        />
      </label>
    </SectionShell>
  );
}
