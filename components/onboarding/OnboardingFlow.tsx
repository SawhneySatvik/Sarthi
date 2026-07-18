"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { AuthenticatedUser } from "@/core/contracts";
import {
  CORE_SCREENS,
  coreAnswersSchema,
  onboardingScreenEnum,
  ONBOARDING_DRAFT_VERSION,
  readOnboardingDraft,
  selectedSpineDomains,
  type CoreAnswersDraft,
  type DomainSpine,
  type OnboardingScreen,
} from "@/core/onboarding";

import { ConfirmCards } from "./ConfirmCards";
import { DetailFlow } from "./detail/DetailFlow";
import { DetailIntro } from "./detail/DetailIntro";
import { Landing } from "./Landing";
import { MOTION } from "./motion";
import { SpineGeneration } from "./SpineGeneration";
import type { SpineOutcome } from "./spineClient";
import { ThemeStep } from "./ThemeStep";
import { B1Name } from "./steps/B1Name";
import { B2Dob } from "./steps/B2Dob";
import { B3Body } from "./steps/B3Body";
import { B4Day } from "./steps/B4Day";
import { B5Goals } from "./steps/B5Goals";
import { B6Time } from "./steps/B6Time";
import { Welcome } from "./steps/Welcome";

const DRAFT_KEY = "sarthi-onboarding-draft";
const ORDER = onboardingScreenEnum.options; // welcome → name → … → timeBudget

/** The post-CORE phases: spine generation (C) → confirm & trim (D) → then the post-accept
 *  polish sequence — E interstitial → E DETAIL grid → F theme → G landing (Pass 3). */
type Phase = "core" | "spine" | "confirm" | "detailIntro" | "detail" | "theme" | "landing";

/** The thin `--energy` CORE progress hairline (§1). Fills across CORE only; the post-CORE
 *  phases (C/D) hold it FULL, so the reviewed plan never feels like unfinished progress. */
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
 * OnboardingFlow — SAR-012 (Pass 1 CORE + Pass 2 spine/confirm/accept + Pass 3 detail/theme/
 * landing). The client phase machine: Phase A (Welcome) → B (CORE B1–B6) → C (spine generation,
 * keyless through the gateway) → D (confirm & trim) → the D-accept tap → E interstitial → E
 * DETAIL grid → F theme → G landing → Today. Transitions crossfade + rise 12px (`--t-base`);
 * reduced-motion = crossfade only. Every CORE answer persists to a versioned local draft;
 * NOTHING is written to the DB until the D-accept tap (the swipe-gate extended to onboarding).
 * On accept the draft clears and the flow advances CLIENT-SIDE through E→G within the same
 * session; a reload with a `complete` profile routes to Today (E gaps already enqueued, D-B).
 */
export function OnboardingFlow({ authMode }: { authMode: AuthenticatedUser["mode"] }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [screen, setScreen] = useState<OnboardingScreen>("welcome");
  const [answers, setAnswers] = useState<CoreAnswersDraft>({});
  const [phase, setPhase] = useState<Phase>("core");
  const [outcomes, setOutcomes] = useState<SpineOutcome[]>([]);
  const [accepting, setAccepting] = useState(false);
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
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: ONBOARDING_DRAFT_VERSION, screen, answers }));
    } catch {
      /* private-mode / unavailable storage — the in-memory flow still works */
    }
  }, [hydrated, screen, answers]);

  const patch = useCallback((partial: CoreAnswersDraft) => {
    setAnswers((prev) => ({ ...prev, ...partial }));
  }, []);

  const next = useCallback(() => {
    const index = ORDER.indexOf(screen);
    if (index < ORDER.length - 1) {
      setScreen(ORDER[index + 1]);
    } else {
      setPhase("spine"); // past the last CORE screen (timeBudget) → generate the spines
    }
  }, [screen]);

  const back = useCallback(() => {
    if (phase === "confirm") {
      setPhase("spine");
      return;
    }
    if (phase === "spine") {
      setPhase("core");
      return;
    }
    setScreen((current) => {
      const index = ORDER.indexOf(current);
      return index > 0 ? ORDER[index - 1] : current;
    });
  }, [phase]);

  const parsedAnswers = coreAnswersSchema.safeParse(answers);
  const completeAnswers = parsedAnswers.success ? parsedAnswers.data : null;
  const domains = completeAnswers ? selectedSpineDomains(completeAnswers) : [];

  const handleAccept = useCallback(
    async (spines: DomainSpine[]) => {
      if (!completeAnswers) return;
      setAccepting(true);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      try {
        const response = await fetch("/api/onboarding/accept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: completeAnswers, spines, timezone }),
        });
        if (response.ok) {
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {
            /* private-mode storage — harmless */
          }
          // The write is committed; advance CLIENT-SIDE into the post-accept polish (E→G).
          setAccepting(false);
          setPhase("detailIntro");
          return;
        }
      } catch {
        /* fall through to re-enable the CTA for a retry */
      }
      setAccepting(false);
    },
    [completeAnswers],
  );

  const handleSpineComplete = useCallback((settled: SpineOutcome[]) => {
    setOutcomes(settled);
    setPhase("confirm");
  }, []);

  const coreIndex = (CORE_SCREENS as readonly string[]).indexOf(screen);
  const fraction = phase !== "core" ? 1 : coreIndex >= 0 ? (coreIndex + 1) / CORE_SCREENS.length : 0;

  function renderStage() {
    if (phase === "spine" && completeAnswers) {
      return <SpineGeneration answers={completeAnswers} domains={domains} onComplete={handleSpineComplete} />;
    }
    if (phase === "confirm" && completeAnswers) {
      return (
        <ConfirmCards
          answers={completeAnswers}
          domains={domains}
          outcomes={outcomes}
          onAccept={handleAccept}
          accepting={accepting}
        />
      );
    }

    // Post-accept polish (Pass 3): the profile is written; these advance client-side only.
    if (phase === "detailIntro") {
      return <DetailIntro onSharpen={() => setPhase("detail")} onLater={() => setPhase("theme")} />;
    }
    if (phase === "detail") {
      return <DetailFlow skillName={completeAnswers?.goals.skillName ?? null} onDone={() => setPhase("theme")} />;
    }
    if (phase === "theme") {
      return <ThemeStep onDone={() => setPhase("landing")} />;
    }
    if (phase === "landing") {
      return <Landing name={completeAnswers?.displayName ?? null} onEnter={() => router.replace("/today")} />;
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

  const stageKey = phase !== "core" ? phase : screen;
  const isWelcome = phase === "core" && screen === "welcome";
  // Post-accept phases (E→G) drop the back chevron — the D-accept write is committed, so there is
  // nothing to step back INTO — AND drop the amber hairline: the plan already exists, so a full
  // standing bar would read as vestigial progress. The hairline is therefore scoped to the
  // plan-creation arc ONLY (A→D: core/spine/confirm, where it fills across CORE then holds full).
  // The header ROW still renders on every non-welcome phase, preserving the top spacing.
  const postAccept = phase === "detailIntro" || phase === "detail" || phase === "theme" || phase === "landing";
  const showHairline = !isWelcome && !postAccept;
  const showHeader = !isWelcome;
  const showBack = !isWelcome && !postAccept;

  return (
    <>
      {showHairline && <Hairline fraction={fraction} />}
      {/* Back chevron on its own top header row (never occluding the Display headline); the
       *  row stays (preserving top spacing) even when the chevron is suppressed post-accept. */}
      {showHeader && (
        <header className="flex shrink-0 items-center pt-7">
          {showBack && <BackChevron onClick={back} />}
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
