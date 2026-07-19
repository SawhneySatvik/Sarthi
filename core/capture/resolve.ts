/**
 * core/capture/resolve.ts — name→entity resolution + auto-demotion (SAR-004, D-C).
 *
 * Turns routed proposals into strict `ResolvedProposal`s using the injected
 * repositories (read-only lookups). Ask-don't-invent: a non-nullable target that
 * does not resolve (unknown habit/skill/category) demotes the proposal to
 * `pending` with a clarification question (§5.1 rule 7) — an auto-eligible proposal
 * LOSES auto on failed resolution; nothing is ever auto-created. `userId` scoping
 * is entirely inside the injected repos; this module never sees a tenant id.
 */
import type { UserScopedRepositories } from "@/core/contracts";

import type { ClarificationQuestion, Proposal, ResolvedProposal } from "./contract";
import { blockedProposalIds, routeProposal } from "./route";

export interface PendingCard {
  proposal: Proposal;
  reasons: readonly string[];
  /** A resolution-demotion question, when the proposal fell to pending for an unknown entity. */
  question: ClarificationQuestion | null;
}

export interface PreparedDraft {
  /** Ready-to-write, fully resolved auto proposals (`status: 'auto'`). */
  autoCommit: ResolvedProposal[];
  /** Everything awaiting explicit user acceptance. */
  pending: PendingCard[];
}

export type ResolveOutcome =
  | { ok: true; resolved: ResolvedProposal }
  | { ok: false; reason: string; question: ClarificationQuestion };

function demotionQuestion(proposal: Proposal, reason: string): ClarificationQuestion {
  return {
    questionId: `${proposal.proposalId}-resolve`,
    prompt: reason,
    blocksProposalIds: [proposal.proposalId],
    options: null,
  };
}

function lowerEq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Resolve one create/accept proposal to a strict `ResolvedProposal`, or demote it.
 * `status` is `'auto'` on the auto path and `'accepted'` when the user accepts a
 * pending card.
 */
export async function resolveProposal(
  proposal: Proposal,
  repos: UserScopedRepositories,
  status: "auto" | "accepted",
): Promise<ResolveOutcome> {
  const base = {
    proposalId: proposal.proposalId,
    domain: proposal.domain,
    intent: proposal.intent,
    occurredAt: proposal.occurredAt,
    localDate: proposal.localDate,
    timezone: proposal.timezone,
    estimated: proposal.estimated,
    confidenceBps: proposal.confidenceBps,
    why: proposal.why,
    evidenceRefs: proposal.evidenceRefs,
    ...(proposal.matchedEntryId !== undefined ? { matchedEntryId: proposal.matchedEntryId } : {}),
    status,
  } as const;

  switch (proposal.kind) {
    case "transaction": {
      const categories = await repos.money.categories.list({});
      const match = categories.find((c) => lowerEq(c.name, proposal.payload.categoryName));
      if (!match) {
        const reason = `category '${proposal.payload.categoryName}' is not set up yet`;
        return { ok: false, reason, question: demotionQuestion(proposal, reason) };
      }
      return {
        ok: true,
        resolved: {
          ...base,
          kind: "transaction",
          payload: {
            direction: proposal.payload.direction,
            amountPaise: proposal.payload.amountPaise,
            categoryId: match.id,
            merchant: proposal.payload.merchant,
            note: proposal.payload.note,
          },
        },
      };
    }
    case "habitLog": {
      const habits = await repos.habits.habits.list({});
      const match = habits.find((h) => !h.isArchived && lowerEq(h.name, proposal.payload.habitName));
      if (!match) {
        const reason = `habit '${proposal.payload.habitName}' is not tracked yet`;
        return { ok: false, reason, question: demotionQuestion(proposal, reason) };
      }
      return {
        ok: true,
        resolved: {
          ...base,
          kind: "habitLog",
          payload: { habitId: match.id, status: proposal.payload.status, note: proposal.payload.note },
        },
      };
    }
    case "skillSession": {
      const skills = await repos.skills.skills.list({});
      const match = skills.find((s) => !s.isArchived && lowerEq(s.name, proposal.payload.skillName));
      if (!match) {
        const reason = `skill '${proposal.payload.skillName}' is not tracked yet`;
        return { ok: false, reason, question: demotionQuestion(proposal, reason) };
      }
      return {
        ok: true,
        resolved: {
          ...base,
          kind: "skillSession",
          payload: { skillId: match.id, minutes: proposal.payload.minutes, note: proposal.payload.note },
        },
      };
    }
    case "water": {
      if (proposal.payload.millilitres === null) {
        const reason = "water volume is unknown";
        return { ok: false, reason, question: demotionQuestion(proposal, reason) };
      }
      return { ok: true, resolved: { ...base, kind: "water", payload: { millilitres: proposal.payload.millilitres } } };
    }
    case "meal":
      return { ok: true, resolved: { ...base, kind: "meal", payload: proposal.payload } };
    case "workout":
      return { ok: true, resolved: { ...base, kind: "workout", payload: proposal.payload } };
    case "weighIn":
      return { ok: true, resolved: { ...base, kind: "weighIn", payload: proposal.payload } };
  }
}

/**
 * Route a whole draft, then resolve the auto-routed proposals — demoting any that
 * fail name resolution. Returns the ready-to-write auto batch and the pending cards.
 * Only `intent: 'create'` proposals ever reach the auto path (routing holds
 * corrections/backdates as pending), so resolution here only ever RESOLVES, never
 * mutates an existing entry.
 */
export async function prepareDraft(
  draft: { proposals: readonly Proposal[]; questions: readonly ClarificationQuestion[] },
  repos: UserScopedRepositories,
): Promise<PreparedDraft> {
  const blocked = blockedProposalIds(draft);
  const autoCommit: ResolvedProposal[] = [];
  const pending: PendingCard[] = [];

  for (const proposal of draft.proposals) {
    const routed = routeProposal(proposal, blocked);
    if (routed.route === "pending") {
      pending.push({ proposal, reasons: routed.reasons, question: null });
      continue;
    }
    const outcome = await resolveProposal(proposal, repos, "auto");
    if (outcome.ok) {
      autoCommit.push(outcome.resolved);
    } else {
      pending.push({ proposal, reasons: [outcome.reason], question: outcome.question });
    }
  }

  return { autoCommit, pending };
}
