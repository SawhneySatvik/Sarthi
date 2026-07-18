"use client";

import { cn } from "@/app/lib/utils";

import { StepFrame } from "../StepFrame";
import type { StepProps } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as a LOCAL `YYYY-MM-DD`, recomputed per render so the `max` bound stays correct
 *  across a long session or a timezone change — never frozen at module load in UTC. */
function todayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/*
 * B2 — "When were you born?" (§4). A native date control: on mobile it's the OS date
 * wheel, on desktop it types (§11 "date wheel has typed fallback" — both, one control).
 * Feeds age → kcal/targets in Pass-2 deriveSpine (incl. the under-18 conservative branch).
 * The native control is tokened (accent-color + ::selection + calendar glyph) so no
 * system-blue ever leaks past the token system (invariant #4).
 */
export function B2Dob({ answers, patch, onContinue }: StepProps) {
  const value = answers.birthDate ?? "";
  return (
    <StepFrame
      title="When were you born?"
      subline="Age quietly shifts the math behind every target."
      onContinue={onContinue}
      continueDisabled={!ISO_DATE.test(value)}
      voice={{
        questionKey: "dob",
        onFilled: (fields) => {
          if (typeof fields.birthDate === "string") patch({ birthDate: fields.birthDate });
        },
      }}
    >
      <input
        type="date"
        value={value}
        max={todayIsoLocal()}
        onChange={(e) => patch({ birthDate: e.target.value })}
        aria-label="Date of birth"
        className={cn(
          "w-full rounded-input border border-line bg-canvas px-3 py-3 font-ui text-body text-ink-1 focus:outline-none",
          // Token the native control so no OS-blue leaks (invariant #4): the picker accent
          // and text selection ride the ink token, and the native calendar glyph is muted
          // to read as ink rather than a system swatch.
          "accent-[color:var(--ink-1)] selection:bg-ink-1 selection:text-canvas",
          "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100",
          // The FOCUSED date segment (day/month/year) is a UA-styled inline field that Chromium
          // paints with system-blue on focus — a highlight no accent-color/::selection rule
          // reaches. Token each segment's focus state directly so it rides the ink token, never
          // the OS swatch (invariant #4). Selector form pins `:focus` to the pseudo-element.
          "[&::-webkit-datetime-edit-day-field:focus]:bg-ink-1 [&::-webkit-datetime-edit-day-field:focus]:text-canvas",
          "[&::-webkit-datetime-edit-month-field:focus]:bg-ink-1 [&::-webkit-datetime-edit-month-field:focus]:text-canvas",
          "[&::-webkit-datetime-edit-year-field:focus]:bg-ink-1 [&::-webkit-datetime-edit-year-field:focus]:text-canvas",
        )}
      />
    </StepFrame>
  );
}
