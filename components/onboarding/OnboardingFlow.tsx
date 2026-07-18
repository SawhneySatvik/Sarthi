"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AuthenticatedUser } from "@/core/contracts";
import {
  CORE_SCREENS,
  onboardingScreenEnum,
  ONBOARDING_DRAFT_VERSION,
  readOnboardingDraft,
  type CoreAnswersDraft,
  type OnboardingScreen,
} from "@/core/onboarding";

import { MOTION } from "./motion";
import { B1Name } from "./steps/B1Name";
import { B2Dob } from "./steps/B2Dob";
import { B3Body } from "./steps/B3Body";
import { B4Day } from "./steps/B4Day";
import { B5Goals } from "./steps/B5Goals";
import { B6Time } from "./steps/B6Time";
import { Welcome } from "./steps/Welcome";

const DRAFT_KEY = "sarthi-onboarding-draft";
const ORDER = onboardingScreenEnum.options; // welcome → name → … → timeBudget

/** The thin `--energy` CORE progress hairline (§1) — the ONLY amber in Pass 1. Fills across
 *  CORE only; DETAIL (Pass 3) never extends it, so skipping later never feels undone. */
function Hairline({ fraction }: { fraction: number }) {
  return (
    <div className="fixed inset-x-0 top-0 z-30" style={{ height: MOTION.hairlinePx }}>
      <div
        className="h-full bg-energy transition-[width] duration-[var(--t-base)] ease-[var(--ease-standard)]"
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
    </div>
  );
}

function BackChevron({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={onClick}
      className="-ml-2 flex h-10 w-10 items-center justify-center rounded-chip text-ink-2"
    >
      <ChevronLeft size={22} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

/*
 * OnboardingFlow — SAR-012 Pass 1. The client phase machine for Phase A (Welcome) + Phase
 * B (CORE B1–B6). Transitions crossfade + rise 12px (`--t-base`); reduced-motion = crossfade
 * only. Every answer persists to a versioned local draft (`sarthi-onboarding-draft`); mount
 * restores to the last answered question (§10 kill-app row). NOTHING is written to the DB in
 * Pass 1 — the draft is the only persistence (the real write is Pass 2's D-accept). After B6
 * the flow lands on a deliberate minimal seam; Phase C spine-gen lands in Pass 2.
 */
export function OnboardingFlow({ authMode }: { authMode: AuthenticatedUser["mode"] }) {
  const reduce = useReducedMotion();
  const [screen, setScreen] = useState<OnboardingScreen>("welcome");
  const [answers, setAnswers] = useState<CoreAnswersDraft>({});
  const [done, setDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore the local draft after mount (client-only; keeps SSR === first client render).
  useEffect(() => {
    let stored: unknown = null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }
    const draft = readOnboardingDraft(stored);
    // One-time restore of the persisted draft AFTER mount. Reading localStorage during
    // render would break SSR / cause a hydration mismatch, so syncing this external state
    // in the mount effect is the correct place (React's own "cache/localStorage" case).
    /* eslint-disable react-hooks/set-state-in-effect */
    if (draft) {
      setScreen(draft.screen);
      setAnswers(draft.answers);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist on every change — but only after the initial restore, so we never clobber a
  // saved draft with the empty mount state.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ version: ONBOARDING_DRAFT_VERSION, screen, answers }),
      );
    } catch {
      /* private-mode / unavailable storage — the in-memory flow still works */
    }
  }, [hydrated, screen, answers]);

  const patch = useCallback((partial: CoreAnswersDraft) => {
    setAnswers((prev) => ({ ...prev, ...partial }));
  }, []);

  const next = useCallback(() => {
    setScreen((current) => {
      const index = ORDER.indexOf(current);
      if (index < ORDER.length - 1) return ORDER[index + 1];
      setDone(true); // past the last CORE screen (timeBudget)
      return current;
    });
  }, []);

  const back = useCallback(() => {
    if (done) {
      setDone(false);
      return;
    }
    setScreen((current) => {
      const index = ORDER.indexOf(current);
      return index > 0 ? ORDER[index - 1] : current;
    });
  }, [done]);

  const coreIndex = (CORE_SCREENS as readonly string[]).indexOf(screen);
  const fraction = done ? 1 : coreIndex >= 0 ? (coreIndex + 1) / CORE_SCREENS.length : 0;

  function renderStage() {
    if (done) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center pb-8 text-center">
          <h1 className="font-display text-display text-ink-1">Your plans are next.</h1>
          <p className="mt-3 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
            In a moment I’ll draft four plans from your answers.
          </p>
          <p className="mt-6 font-ui text-caption uppercase tracking-wide text-ink-3">Coming in the next step</p>
        </div>
      );
    }
    const step = { answers, patch, onContinue: next };
    switch (screen) {
      case "welcome":
        return <Welcome authMode={authMode} onBegin={next} />;
      case "name":
        return <B1Name {...step} />;
      case "dob":
        return <B2Dob {...step} />;
      case "body":
        return <B3Body {...step} />;
      case "day":
        return <B4Day {...step} />;
      case "goals":
        return <B5Goals {...step} />;
      case "timeBudget":
        return <B6Time {...step} />;
      default:
        return null;
    }
  }

  const stageKey = done ? "done" : screen;
  const showChrome = screen !== "welcome";

  return (
    <>
      {showChrome && <Hairline fraction={fraction} />}
      {/* Back chevron on its own top header row (never occluding the Display headline), with
          ~28px top safe-area below the hairline so ascenders are never clipped. */}
      {showChrome && (
        <header className="flex shrink-0 items-center pt-7">
          <BackChevron onClick={back} />
        </header>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stageKey}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.risePx }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -MOTION.risePx }}
          transition={{ duration: MOTION.crossfadeSec, ease: MOTION.ease }}
          className="flex flex-1 flex-col"
        >
          {renderStage()}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
