import type { ClarificationQuestion } from "@/core/capture/contract";

/*
 * Ask-don't-invent clarification card (SAR-006, D-E). Blocks ONLY its own
 * `blocksProposalIds` — the rest of the deck stays fully usable. SAR-006 blocks
 * correctly and lets the user skip for now; the full answer→re-resolve flow (which
 * would make the option chips actually resolve the proposal) is SAR-014. Until then
 * the options are shown as read-only context, not tappable "answers" that secretly
 * skip — only the explicit Skip action is offered.
 */
export function QuestionCard({
  question,
  onSkip,
}: {
  question: ClarificationQuestion;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-card border border-line bg-raised p-4">
      <p className="font-coach text-body leading-[var(--leading-coach)] text-ink-1">{question.prompt}</p>
      <button type="button" onClick={onSkip} className="mt-3 font-ui text-caption text-ink-3 underline">
        Skip for now
      </button>
    </div>
  );
}
