"use client";

import { useState } from "react";

import { SelectChip } from "@/components/onboarding/SelectChip";
import type { OnboardingDetailInput } from "@/core/onboarding";

import { SectionShell } from "../SectionShell";

/*
 * E1 — Food pattern (§7). Diet chips + how food is sourced. Save requires one of each; the
 * result patches `foodPattern` and resolves the `detail-food` gap. Chips ≥44px, tokens only.
 */
type Diet = "veg" | "egg" | "non_veg" | "mixed";
type Cooking = "cook" | "order" | "mess";

const DIETS: ReadonlyArray<{ id: Diet; label: string }> = [
  { id: "veg", label: "veg" },
  { id: "egg", label: "egg" },
  { id: "non_veg", label: "non-veg" },
  { id: "mixed", label: "mixed" },
];

const COOKING: ReadonlyArray<{ id: Cooking; label: string }> = [
  { id: "cook", label: "cook" },
  { id: "order", label: "order" },
  { id: "mess", label: "mess / canteen" },
];

export function E1Food({
  onSave,
  onSkip,
  saving,
}: {
  onSave: (payload: OnboardingDetailInput) => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const [diet, setDiet] = useState<Diet | null>(null);
  const [cooking, setCooking] = useState<Cooking | null>(null);

  return (
    <SectionShell
      title="How do you eat?"
      subline="So meal estimates and suggestions fit your plate."
      saving={saving}
      saveDisabled={diet === null || cooking === null}
      onSkip={onSkip}
      onSave={() => {
        if (diet === null || cooking === null) return;
        onSave({ section: "food", diet, cooking });
      }}
    >
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 font-ui text-caption uppercase tracking-wide text-ink-2">Most days</p>
          <div className="flex flex-wrap gap-2">
            {DIETS.map((option) => (
              <SelectChip key={option.id} active={diet === option.id} onClick={() => setDiet(option.id)}>
                {option.label}
              </SelectChip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-ui text-caption uppercase tracking-wide text-ink-2">Usually</p>
          <div className="flex flex-wrap gap-2">
            {COOKING.map((option) => (
              <SelectChip key={option.id} active={cooking === option.id} onClick={() => setCooking(option.id)}>
                {option.label}
              </SelectChip>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
