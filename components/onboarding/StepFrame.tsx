"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import type { FillQuestionKey } from "@/core/onboarding";

import { VoiceFillButton } from "./VoiceFillButton";

/*
 * StepFrame — SAR-012 Pass 1. The shared per-question surface (§2): a Display-type
 * question, an optional Fraunces (`font-coach`) sub-line in the coach's voice, the answer
 * surface, a neutral `Continue` (never amber — invariant #4), and the always-present mic
 * bottom-right. `Skip` is deliberately absent — it belongs to DETAIL only (Pass 3), never
 * CORE. Voice-fill is wired per question so a spoken answer parses into just its field(s).
 */
export function StepFrame({
  title,
  subline,
  children,
  onContinue,
  continueDisabled = false,
  continueLabel = "Continue",
  voice,
}: {
  title: string;
  subline?: string;
  children: ReactNode;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  voice?: {
    questionKey: FillQuestionKey;
    onFilled: (fields: Record<string, unknown>) => void;
    onUnparseable?: () => void;
  };
}) {
  return (
    <div className="flex flex-1 flex-col pb-28">
      <div className="flex-1">
        {/* On the full-bleed painterly backdrop (UIE-5): LIGHT on-art inks over `--scrim-art`
            pass AA in every theme-mode, including Bone light. */}
        <h1 className="font-display text-display-xl on-art">{title}</h1>
        {subline && (
          <p className="mt-3 font-coach text-body leading-[var(--leading-coach)] on-art-dim">{subline}</p>
        )}
        <div className="mt-8">{children}</div>
      </div>

      <Button className="mt-8 w-full" onClick={onContinue} disabled={continueDisabled}>
        {continueLabel}
      </Button>

      {voice && (
        <VoiceFillButton
          questionKey={voice.questionKey}
          onFilled={voice.onFilled}
          onUnparseable={voice.onUnparseable}
        />
      )}
    </div>
  );
}
