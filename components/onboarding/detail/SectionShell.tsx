"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";

/*
 * SectionShell — SAR-012 Pass 3. The shared surface for one DETAIL section (§7): a Display
 * heading, an optional Fraunces (`font-coach`) sub-line in the coach's voice, the answer
 * surface, a neutral `Save` (never amber — invariant #4), and an always-visible `Skip`.
 * Skip leaves the section's `profile_gap` open for the SAR-014 backfill; Save posts the patch.
 */
export function SectionShell({
  title,
  subline,
  children,
  onSave,
  onSkip,
  saving = false,
  saveDisabled = false,
  saveLabel = "Save",
}: {
  title: string;
  subline?: string;
  children: ReactNode;
  onSave: () => void;
  onSkip: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-1 flex-col pb-10">
      <div className="flex-1">
        <h1 className="font-display text-display text-ink-1">{title}</h1>
        {subline && (
          <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">{subline}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Button className="flex-1 min-h-11" onClick={onSave} disabled={saving || saveDisabled}>
          {saving ? "Saving…" : saveLabel}
        </Button>
        <button type="button" onClick={onSkip} className="px-4 py-3 min-h-11 font-ui text-body text-ink-2">
          Skip
        </button>
      </div>
    </div>
  );
}
