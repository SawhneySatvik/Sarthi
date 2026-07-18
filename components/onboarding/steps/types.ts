import type { CoreAnswersDraft } from "@/core/onboarding";

/** The contract every CORE (B1–B6) step is driven by. Steps read from the accumulating
 *  draft, `patch` merges answers back (persisted by the flow), `onContinue` advances. */
export interface StepProps {
  answers: CoreAnswersDraft;
  patch: (partial: CoreAnswersDraft) => void;
  onContinue: () => void;
}
