"use client";

import { useState } from "react";

import { SelectChip } from "@/components/onboarding/SelectChip";
import type { OnboardingDetailInput } from "@/core/onboarding";

import { SectionShell } from "../SectionShell";

/*
 * E3 — Focus (§7). One chip: how your attention runs. Save patches `focusPreference` and
 * resolves the `detail-focus` gap (it tunes session lengths + the Tools timer default later).
 */
type Focus = "deep" | "depends" | "distractible";

const OPTIONS: ReadonlyArray<{ id: Focus; label: string }> = [
  { id: "deep", label: "I focus deeply" },
  { id: "depends", label: "depends on the day" },
  { id: "distractible", label: "easily pulled away" },
];

export function E3Focus({
  onSave,
  onSkip,
  saving,
}: {
  onSave: (payload: OnboardingDetailInput) => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const [focus, setFocus] = useState<Focus | null>(null);

  return (
    <SectionShell
      title="How's your focus?"
      subline="So I size your sessions to your real attention span."
      saving={saving}
      saveDisabled={focus === null}
      onSkip={onSkip}
      onSave={() => {
        if (focus === null) return;
        onSave({ section: "focus", focus });
      }}
    >
      <div className="flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <SelectChip
            key={option.id}
            active={focus === option.id}
            onClick={() => setFocus(option.id)}
            className="w-full text-left"
          >
            {option.label}
          </SelectChip>
        ))}
      </div>
    </SectionShell>
  );
}
