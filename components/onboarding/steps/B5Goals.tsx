"use client";

import { useState } from "react";

import { cn } from "@/app/lib/utils";
import { EMPTY_GOALS, GOAL_GROUPS, goalsSchema, hasAtLeastOneDomain, type Goals } from "@/core/onboarding";

import { SelectChip } from "../SelectChip";
import { StepFrame } from "../StepFrame";
import type { StepProps } from "./types";

type GoalDomain = (typeof GOAL_GROUPS)[number]["domain"];

/*
 * B5 — "Pick your battles" (§4). One multi-select chip group per domain, plus the Skills
 * "+ name one" free text. B5 requires ≥1 domain (any chip, or a named skill) to continue;
 * un-selected domains simply get no plan (Pass 2). An unparseable voice-fill pulses (§10).
 */
export function B5Goals({ answers, patch, onContinue }: StepProps) {
  const [pulse, setPulse] = useState(0);
  const goals: Goals = answers.goals ?? EMPTY_GOALS;

  function toggle(domain: GoalDomain, id: string) {
    const current = goals[domain] as string[];
    const nextArr = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    patch({ goals: { ...goals, [domain]: nextArr } as Goals });
  }

  return (
    <StepFrame
      title="Pick your battles"
      subline="Choose any — un-picked lives just wait for you on Today."
      onContinue={onContinue}
      continueDisabled={!hasAtLeastOneDomain(goals)}
      voice={{
        questionKey: "goals",
        onFilled: (fields) => {
          const parsed = goalsSchema.safeParse(fields);
          if (parsed.success) patch({ goals: parsed.data });
        },
        onUnparseable: () => setPulse((p) => p + 1),
      }}
    >
      <div key={pulse} className={cn("flex flex-col gap-6", pulse > 0 && "animate-onboarding-pulse")}>
        {GOAL_GROUPS.map((group) => (
          <div key={group.domain}>
            <p className="mb-2 font-ui text-caption uppercase tracking-wide on-art-dim">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => (
                <SelectChip
                  key={option.id}
                  active={(goals[group.domain] as string[]).includes(option.id)}
                  onClick={() => toggle(group.domain, option.id)}
                >
                  {option.label}
                </SelectChip>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-2 font-ui text-caption uppercase tracking-wide on-art-dim">Skills</p>
          <input
            value={goals.skillName ?? ""}
            onChange={(e) => patch({ goals: { ...goals, skillName: e.target.value.length ? e.target.value : null } })}
            placeholder="+ name one (e.g. system design)"
            aria-label="Name a skill"
            className="w-full rounded-input border border-line bg-canvas px-3 py-3 font-ui text-body text-ink-1 placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </StepFrame>
  );
}
