/**
 * core/capture/route.ts — the route-by-confidence policy (SAR-004, D-B).
 *
 * The SINGLE owner of `AUTO_WRITE_CONFIDENCE_BPS`. Pure and deterministic: no repo,
 * no clock, no provider. Implements ARCHITECTURE §5.1 rules 3–7. A proposal is
 * `auto` only when it is an explicit, high-confidence, complete `create` with no
 * open clarification; EVERYTHING else is `pending` and writes only on explicit
 * acceptance — the trust invariant (nothing estimated writes unconfirmed).
 *
 * Name→entity resolution can further demote an `auto` proposal to `pending`
 * (unknown habit/skill/category) — that lives in `resolve.ts` (D-C), because it
 * needs the repositories; routing here is purely intrinsic to the proposal.
 */
import type { CaptureDraft, ClarificationQuestion, Proposal } from "./contract";

/** Rule 3: the only threshold at which an explicit proposal auto-files. Owned here alone. */
export const AUTO_WRITE_CONFIDENCE_BPS = 9000;
/** Rule 6: the floor for including a pending card in an explicit Accept-all. */
export const ACCEPT_ALL_MIN_CONFIDENCE_BPS = 8000;

export type ProposalRoute = "auto" | "pending";

export interface RoutedProposal {
  proposalId: string;
  route: ProposalRoute;
  /** Human-readable reasons a proposal is pending (empty when auto). */
  reasons: readonly string[];
}

/** The proposal ids blocked by an unanswered clarification question (rule 7). */
export function blockedProposalIds(draft: { questions: readonly ClarificationQuestion[] }): Set<string> {
  const blocked = new Set<string>();
  for (const question of draft.questions) {
    for (const id of question.blocksProposalIds) {
      blocked.add(id);
    }
  }
  return blocked;
}

/**
 * Whether the load-bearing quantity a write depends on is known. The only
 * draft-permissive null primary quantity is `water.millilitres` ("drank a bottle"),
 * so a null there is the one intrinsic "unknown value" that forces pending.
 */
function primaryQuantityKnown(proposal: Proposal): boolean {
  if (proposal.kind === "water") {
    return proposal.payload.millilitres !== null;
  }
  return true;
}

/** Rule 3–4/7: route one proposal by its intrinsic fields. */
export function routeProposal(proposal: Proposal, blockedIds: ReadonlySet<string>): RoutedProposal {
  const reasons: string[] = [];
  if (proposal.intent !== "create") {
    reasons.push(`intent '${proposal.intent}' requires explicit confirmation`);
  }
  if (proposal.estimated) {
    reasons.push("estimated value must be confirmed");
  }
  if (proposal.confidenceBps < AUTO_WRITE_CONFIDENCE_BPS) {
    reasons.push(`confidence ${proposal.confidenceBps} below auto threshold ${AUTO_WRITE_CONFIDENCE_BPS}`);
  }
  if (!primaryQuantityKnown(proposal)) {
    reasons.push("a required quantity is unknown");
  }
  // Rule 4: a photo/vision-derived value NEVER auto-writes — even an explicit,
  // high-confidence printed receipt amount routes to pending. Keyed on a non-empty
  // `evidenceRefs` (SAR-011); every text/voice proposal is empty here, so this
  // regresses nothing. The commit route's auto re-route (D-040) makes it
  // server-enforced against a mislabelled client.
  if (proposal.evidenceRefs.length > 0) {
    reasons.push("photo-derived value requires confirmation");
  }
  if (blockedIds.has(proposal.proposalId)) {
    reasons.push("a clarification question must be answered first");
  }
  return {
    proposalId: proposal.proposalId,
    route: reasons.length === 0 ? "auto" : "pending",
    reasons,
  };
}

/** Partition a whole draft. */
export function routeDraft(draft: CaptureDraft): RoutedProposal[] {
  const blocked = blockedProposalIds(draft);
  return draft.proposals.map((proposal) => routeProposal(proposal, blocked));
}

/**
 * Rule 5: a user edit turns the resolved value into an explicit confirmation —
 * `estimated:false`, full confidence, `why.basis:'user edit'`. Accepting the
 * edited card is the confirmation.
 */
export function applyUserEdit(proposal: Proposal, payloadPatch: Record<string, unknown>): Proposal {
  return {
    ...proposal,
    estimated: false,
    confidenceBps: 10000,
    why: { basis: "user edit", assumptions: [] },
    payload: { ...(proposal.payload as Record<string, unknown>), ...payloadPatch },
  } as unknown as Proposal;
}

/**
 * Rule 6: Accept-all is offered only when every remaining card is pending, each at
 * or above the accept-all floor, and none is blocked by a question. It is still an
 * explicit user action performed by the caller — this only reports eligibility.
 */
export function isAcceptAllEligible(
  pending: readonly Proposal[],
  blockedIds: ReadonlySet<string>,
): boolean {
  return (
    pending.length > 0 &&
    pending.every(
      (proposal) =>
        proposal.confidenceBps >= ACCEPT_ALL_MIN_CONFIDENCE_BPS &&
        !blockedIds.has(proposal.proposalId),
    )
  );
}
