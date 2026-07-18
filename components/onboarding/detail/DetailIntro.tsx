"use client";

import { Button } from "@/components/ui/Button";

/*
 * Phase E interstitial (§7). "Five quick things sharpen the coach. Answer now, or I'll ask as
 * we go." → `Sharpen it` (into the section grid) / `Later — take me in` (skip straight to the
 * theme step). Skipping is safe — the CORE hairline is already full and every un-answered
 * section's `profile_gap` is queued for the SAR-014 daily-brief backfill. Neutral CTAs only.
 */
export function DetailIntro({ onSharpen, onLater }: { onSharpen: () => void; onLater: () => void }) {
  return (
    <div className="flex flex-1 flex-col pb-10">
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="font-display text-display-xl text-ink-1">Five quick things sharpen the coach.</h1>
        <p className="mt-3 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
          Answer now, or I&rsquo;ll ask as we go.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button className="w-full min-h-11" onClick={onSharpen}>
          Sharpen it
        </Button>
        <button type="button" onClick={onLater} className="w-full min-h-11 py-3 font-ui text-body text-ink-2">
          Later — take me in
        </button>
      </div>
    </div>
  );
}
