"use client";

import { Button } from "@/components/ui/Button";
import type { Proposal } from "@/core/capture/contract";
import { isAcceptAllEligible } from "@/core/capture/route";

import { EstimateCard } from "./EstimateCard";

/*
 * Confirm zone 2 (SAR-006, D-C/D-D): the estimate deck — a card stack where the top
 * card is interactive and the next two peek behind. Accept-all appears only when
 * every remaining card clears the accept-all floor and none is blocked.
 */
export function EstimateDeck({
  proposals,
  blockedIds,
  onAccept,
  onDiscard,
  onAcceptAll,
}: {
  proposals: readonly Proposal[];
  blockedIds: ReadonlySet<string>;
  onAccept: (proposal: Proposal) => void;
  onDiscard: (proposalId: string) => void;
  onAcceptAll: () => void;
}) {
  if (proposals.length === 0) return null;
  const [top, ...rest] = proposals;
  const showAcceptAll = isAcceptAllEligible(proposals, blockedIds);

  return (
    <div className="px-4">
      <p className="mb-2 font-ui text-caption uppercase tracking-wide text-ink-3">
        Confirm estimates · {proposals.length} left
      </p>
      <div className="relative">
        {rest.length > 0 && (
          <div className="absolute inset-x-2 top-1 -z-10 h-full rounded-card border border-line bg-card opacity-50" aria-hidden />
        )}
        {rest.length > 1 && (
          <div className="absolute inset-x-4 top-2 -z-20 h-full rounded-card border border-line bg-card opacity-30" aria-hidden />
        )}
        <EstimateCard
          key={top.proposalId}
          proposal={top}
          blocked={blockedIds.has(top.proposalId)}
          onAccept={onAccept}
          onDiscard={() => onDiscard(top.proposalId)}
        />
      </div>
      {showAcceptAll && (
        <Button variant="ghost" className="mt-3 w-full" onClick={onAcceptAll}>
          Accept all {proposals.length}
        </Button>
      )}
    </div>
  );
}
