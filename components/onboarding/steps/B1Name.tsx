"use client";

import { StepFrame } from "../StepFrame";
import type { StepProps } from "./types";

/** B1 — "What should I call you?" (§4). Name text; voice-fill fills `displayName`. */
export function B1Name({ answers, patch, onContinue }: StepProps) {
  const value = answers.displayName ?? "";
  return (
    <StepFrame
      title="What should I call you?"
      onContinue={onContinue}
      continueDisabled={value.trim().length === 0}
      voice={{
        questionKey: "name",
        onFilled: (fields) => {
          if (typeof fields.displayName === "string") patch({ displayName: fields.displayName });
        },
      }}
    >
      <input
        value={value}
        onChange={(e) => patch({ displayName: e.target.value })}
        placeholder="Your name"
        aria-label="Your name"
        className="w-full border-b border-line bg-transparent pb-2 font-display text-display text-ink-1 placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </StepFrame>
  );
}
