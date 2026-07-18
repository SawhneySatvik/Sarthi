"use client";

import { Button } from "@/components/ui/Button";
import type { AuthenticatedUser } from "@/core/contracts";

/*
 * Phase A — Welcome (§3). Full scene (gradient placeholder from the layout) · wordmark ·
 * one line · Begin. Keyless (`authMode === 'local'`) renders NO sign-in affordance (D-C);
 * the quiet "I have an account" link only appears once SAR-021 lands real auth. The demo
 * long-press gesture is Pass 3 (D-G) — deliberately NOT wired here.
 */
export function Welcome({ authMode, onBegin }: { authMode: AuthenticatedUser["mode"]; onBegin: () => void }) {
  return (
    <div className="flex flex-1 flex-col pb-8">
      <p className="pt-12 text-center font-display text-title uppercase tracking-[0.35em] text-ink-2">Sarthi</p>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-display-xl text-ink-1">One sentence a day. Four lives in order.</h1>
      </div>

      <Button className="w-full" onClick={onBegin}>
        Begin
      </Button>
      {authMode !== "local" && (
        <button type="button" className="mt-4 font-ui text-caption text-ink-3 underline">
          I have an account
        </button>
      )}
    </div>
  );
}
