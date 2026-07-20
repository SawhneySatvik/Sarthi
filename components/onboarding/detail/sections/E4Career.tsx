"use client";

import { useState } from "react";

import { SelectChip } from "@/components/onboarding/SelectChip";
import type { OnboardingDetailInput } from "@/core/onboarding";

import { SectionShell } from "../SectionShell";

/*
 * E4 — Career & skills detail (§7). A field-of-work chip (free text for "other") + an optional
 * current-level chip for the skill you named in B5. Save patches `careerGoal` and resolves the
 * `detail-career` gap (it sets how deep the Skills curriculum goes). Skill name from B5 shown.
 */
type Field = "swe" | "student" | "design" | "business" | "other";
type Level = "new" | "some" | "solid";

const FIELDS: ReadonlyArray<{ id: Field; label: string }> = [
  { id: "swe", label: "SWE" },
  { id: "student", label: "student" },
  { id: "design", label: "design" },
  { id: "business", label: "business" },
  { id: "other", label: "other" },
];

const LEVELS: ReadonlyArray<{ id: Level; label: string }> = [
  { id: "new", label: "new" },
  { id: "some", label: "some" },
  { id: "solid", label: "solid" },
];

export function E4Career({
  skillName,
  onSave,
  onSkip,
  saving,
}: {
  skillName: string | null;
  onSave: (payload: OnboardingDetailInput) => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const [field, setField] = useState<Field | null>(null);
  const [fieldOther, setFieldOther] = useState("");
  const [level, setLevel] = useState<Level | null>(null);

  return (
    <SectionShell
      title="What's your work?"
      subline="So the skill path starts at the right depth."
      saving={saving}
      saveDisabled={field === null}
      onSkip={onSkip}
      onSave={() => {
        if (field === null) return;
        onSave({
          section: "career",
          field,
          fieldOther: field === "other" ? (fieldOther.trim() || null) : null,
          skillLevel: level,
        });
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          {FIELDS.map((option) => (
            <SelectChip key={option.id} active={field === option.id} onClick={() => setField(option.id)}>
              {option.label}
            </SelectChip>
          ))}
        </div>

        {field === "other" && (
          <input
            value={fieldOther}
            onChange={(event) => setFieldOther(event.target.value)}
            placeholder="what do you do?"
            aria-label="Your field"
            className="w-full rounded-input border border-line bg-canvas px-3 py-3 font-ui text-body text-ink-1 placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}

        {skillName && (
          <div>
            <p className="mb-2 font-ui text-caption uppercase tracking-wide text-ink-2">
              {skillName} — where are you?
            </p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((option) => (
                <SelectChip
                  key={option.id}
                  active={level === option.id}
                  onClick={() => setLevel(level === option.id ? null : option.id)}
                >
                  {option.label}
                </SelectChip>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
