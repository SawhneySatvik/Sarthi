"use client";

import { useState } from "react";

import { cn } from "@/app/lib/utils";
import { TIME_BUDGETS } from "@/core/onboarding";

import { SelectChip } from "../SelectChip";
import { StepFrame } from "../StepFrame";
import type { StepProps } from "./types";

/*
 * B6 — "How much time can you actually give?" (§4). Chips → integer minutes/day
 * (`timeBudgetMinutes`), driving plan density in Pass-2 deriveSpine. Last CORE screen —
 * `Continue` completes the CORE walk. An unparseable voice-fill pulses the chips (§10).
 */
export function B6Time({ answers, patch, onContinue }: StepProps) {
  const [pulse, setPulse] = useState(0);
  const selected = answers.timeBudgetMinutes ?? null;

  return (
    <StepFrame
      title="How much time can you actually give?"
      onContinue={onContinue}
      continueDisabled={selected === null}
      voice={{
        questionKey: "timeBudget",
        onFilled: (fields) => {
          if (typeof fields.timeBudgetMinutes === "number") patch({ timeBudgetMinutes: fields.timeBudgetMinutes });
        },
        onUnparseable: () => setPulse((p) => p + 1),
      }}
    >
      <div key={pulse} className={cn("flex flex-wrap gap-2", pulse > 0 && "animate-onboarding-pulse")}>
        {TIME_BUDGETS.map((option) => (
          <SelectChip
            key={option.minutes}
            active={selected === option.minutes}
            onClick={() => patch({ timeBudgetMinutes: option.minutes })}
            className="min-w-[4.5rem] justify-center"
          >
            {option.label}
          </SelectChip>
        ))}
      </div>
    </StepFrame>
  );
}
