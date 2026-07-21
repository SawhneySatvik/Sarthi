"use client";

import { Minus, Plus } from "lucide-react";

import {
  cmFromImperial,
  gramsFromKg,
  gramsFromLb,
  imperialFromCm,
  kgFromGrams,
  lbFromGrams,
} from "@/core/onboarding";

import { SelectChip } from "../SelectChip";
import { StepFrame } from "../StepFrame";
import type { StepProps } from "./types";

const DEFAULT_CM = 170;
const DEFAULT_GRAMS = 70000;

function Stepper({ label, value, onDelta }: { label: string; value: string; onDelta: (delta: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-card border border-line bg-card px-4 py-3">
      <span className="font-ui text-caption uppercase tracking-wide text-ink-3">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onDelta(-1)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-chip border border-line text-ink-2"
        >
          <Minus size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <span className="min-w-[5rem] text-center font-display text-title tabular-nums text-ink-1">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onDelta(1)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-chip border border-line text-ink-2"
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/*
 * B3 — "Your body, roughly" (§4). Height + weight steppers with a cm/kg ⇄ ft-in/lb toggle.
 * The canonical value is ALWAYS metric integers (heightCm/weightGrams); the imperial view
 * converts for display and back at the boundary (invariant #2 — no float ever stored).
 */
export function B3Body({ answers, patch, onContinue }: StepProps) {
  const unitSystem = answers.unitSystem ?? "metric";
  const heightCm = answers.heightCm ?? DEFAULT_CM;
  const weightGrams = answers.weightGrams ?? DEFAULT_GRAMS;
  const imperial = unitSystem === "imperial";

  const { feet, inches } = imperialFromCm(heightCm);
  const heightLabel = imperial ? `${feet}'${inches}"` : `${heightCm} cm`;
  const weightLabel = imperial ? `${lbFromGrams(weightGrams)} lb` : `${kgFromGrams(weightGrams)} kg`;

  function stepHeight(delta: number) {
    if (imperial) {
      const totalInches = feet * 12 + inches + delta;
      patch({ heightCm: cmFromImperial(0, Math.max(1, totalInches)) });
    } else {
      patch({ heightCm: Math.max(1, heightCm + delta) });
    }
  }

  function stepWeight(delta: number) {
    if (imperial) {
      patch({ weightGrams: gramsFromLb(Math.max(1, lbFromGrams(weightGrams) + delta)) });
    } else {
      patch({ weightGrams: gramsFromKg(Math.max(1, kgFromGrams(weightGrams) + delta)) });
    }
  }

  return (
    <StepFrame
      title="Your body, roughly"
      subline="Rough is fine — you can sharpen it later."
      // Persist the resolved values even if the user accepted the defaults untouched.
      onContinue={() => {
        patch({ heightCm, weightGrams, unitSystem });
        onContinue();
      }}
      voice={{
        questionKey: "body",
        onFilled: (fields) => {
          const next: { heightCm?: number; weightGrams?: number } = {};
          if (typeof fields.heightCm === "number") next.heightCm = fields.heightCm;
          if (typeof fields.weightGrams === "number") next.weightGrams = fields.weightGrams;
          patch(next);
        },
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 self-start rounded-chip border border-line p-1" role="group" aria-label="Units">
          <SelectChip
            active={!imperial}
            onClick={() => patch({ unitSystem: "metric" })}
            className="min-h-0 px-3 py-1.5 text-caption"
          >
            cm / kg
          </SelectChip>
          <SelectChip
            active={imperial}
            onClick={() => patch({ unitSystem: "imperial" })}
            className="min-h-0 px-3 py-1.5 text-caption"
          >
            ft-in / lb
          </SelectChip>
        </div>

        <Stepper label="Height" value={heightLabel} onDelta={stepHeight} />
        <Stepper label="Weight" value={weightLabel} onDelta={stepWeight} />
      </div>
    </StepFrame>
  );
}
