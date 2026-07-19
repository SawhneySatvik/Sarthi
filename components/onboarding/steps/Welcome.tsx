"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { AuthenticatedUser } from "@/core/contracts";

/*
 * Phase A — Welcome (§3). Full scene (gradient placeholder from the layout) · wordmark · one
 * line · Begin. Keyless (`authMode === 'local'`) renders NO sign-in affordance (D-C); the
 * quiet "I have an account" link only appears once SAR-021 lands real auth.
 *
 * Demo-seed gesture (§10, D-G): a long-press (~800ms) on the wordmark opens a confirm sheet
 * that runs the keyless, `seed_runs`-idempotent `POST /api/dev/seed-demo` (guarded 404 unless
 * local) and lands on the populated Today. Invisible otherwise, and only ARMED in local mode
 * so nothing dead ships in a real deployment.
 */
const LONG_PRESS_MS = 800;

export function Welcome({ authMode, onBegin }: { authMode: AuthenticatedUser["mode"]; onBegin: () => void }) {
  const router = useRouter();
  const isLocal = authMode === "local";
  const [confirming, setConfirming] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const startPress = useCallback(() => {
    if (!isLocal) return;
    clearTimer();
    timer.current = setTimeout(() => setConfirming(true), LONG_PRESS_MS);
  }, [isLocal, clearTimer]);

  const runSeed = useCallback(async () => {
    setSeeding(true);
    try {
      const response = await fetch("/api/dev/seed-demo", { method: "POST" });
      if (response.ok) {
        router.replace("/today");
        return;
      }
    } catch {
      /* fall through to re-enable the sheet for a retry */
    }
    setSeeding(false);
  }, [router]);

  return (
    <div className="flex flex-1 flex-col pb-8">
      <p
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        className="select-none pt-12 text-center font-display text-title uppercase tracking-[0.35em] text-ink-2"
      >
        Sarthi
      </p>

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

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "var(--scrim)" }}>
          <div className="w-full max-w-[33rem] rounded-t-card border border-line bg-raised p-5">
            <p className="font-display text-title text-ink-1">Load the demo?</p>
            <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
              Fills a seeded demo journey to explore. Dev only.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button className="flex-1" onClick={runSeed} disabled={seeding}>
                {seeding ? "Loading…" : "Load demo"}
              </Button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-4 py-3 font-ui text-body text-ink-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
