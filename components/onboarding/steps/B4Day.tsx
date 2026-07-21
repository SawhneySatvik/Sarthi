"use client";

import { useState } from "react";

import { cn } from "@/app/lib/utils";
import { clockLabel, DAY_SHAPES, dayShapeEnum, type DayShape } from "@/core/onboarding";

import { SelectChip } from "../SelectChip";
import { StepFrame } from "../StepFrame";
import type { StepProps } from "./types";

const DEFAULT_WAKE = 360; // 06:00
const DEFAULT_SLEEP = 1380; // 23:00

/*
 * B4 — "What does your day look like?" (§4). Day-shape chips + a wake/sleep dual slider.
 * Both times are stored as integer minutes-from-midnight (invariant #2). Feeds Habits
 * cadence + plan timing in Pass-2 deriveSpine. dayShape is NOT a profile column — it lives
 * in the draft only. An unparseable voice-fill pulses the chips once (§10).
 */
export function B4Day({ answers, patch, onContinue }: StepProps) {
  const [pulse, setPulse] = useState(0);
  const dayShape = answers.dayShape ?? null;
  const wake = answers.wakeTimeMinutes ?? DEFAULT_WAKE;
  const sleep = answers.sleepTimeMinutes ?? DEFAULT_SLEEP;

  return (
    <StepFrame
      title="What does your day look like?"
      onContinue={() => {
        patch({ wakeTimeMinutes: wake, sleepTimeMinutes: sleep });
        onContinue();
      }}
      continueDisabled={dayShape === null}
      voice={{
        questionKey: "day",
        onFilled: (fields) => {
          const next: { dayShape?: DayShape; wakeTimeMinutes?: number; sleepTimeMinutes?: number } = {};
          const shape = dayShapeEnum.safeParse(fields.dayShape);
          if (shape.success) next.dayShape = shape.data;
          if (typeof fields.wakeTimeMinutes === "number") next.wakeTimeMinutes = fields.wakeTimeMinutes;
          if (typeof fields.sleepTimeMinutes === "number") next.sleepTimeMinutes = fields.sleepTimeMinutes;
          patch(next);
        },
        onUnparseable: () => setPulse((p) => p + 1),
      }}
    >
      <div key={pulse} className={cn("flex flex-wrap gap-2", pulse > 0 && "animate-onboarding-pulse")}>
        {DAY_SHAPES.map((option) => (
          <SelectChip
            key={option.id}
            active={dayShape === option.id}
            onClick={() => patch({ dayShape: option.id })}
          >
            {option.label}
          </SelectChip>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between font-ui text-caption uppercase tracking-wide on-art-dim">
            Wake <span className="font-display text-body tabular-nums on-art">{clockLabel(wake)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1439}
            step={15}
            value={wake}
            onChange={(e) => patch({ wakeTimeMinutes: Number(e.target.value) })}
            aria-label="Wake time"
            className="w-full accent-[color:var(--ink-1)]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between font-ui text-caption uppercase tracking-wide on-art-dim">
            Sleep <span className="font-display text-body tabular-nums on-art">{clockLabel(sleep)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1439}
            step={15}
            value={sleep}
            onChange={(e) => patch({ sleepTimeMinutes: Number(e.target.value) })}
            aria-label="Sleep time"
            className="w-full accent-[color:var(--ink-1)]"
          />
        </label>
      </div>
    </StepFrame>
  );
}
