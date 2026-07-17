import { Check, Undo2 } from "lucide-react";

import type { Proposal } from "@/core/capture/contract";

import { DOMAIN_DOT } from "../today/domain";
import { displayProposal, formatPrimary } from "./proposalText";

/*
 * Confirm zone 1 (SAR-006, D-C): the "filed automatically" strip. Calm, settled
 * micro-rows for the explicit auto-written proposals — deliberately different from
 * the live estimate deck. Swipe-left / the undo affordance reverses the auto batch.
 */
export function FiledStrip({ proposals, onUndo }: { proposals: readonly Proposal[]; onUndo?: () => void }) {
  if (proposals.length === 0) return null;
  return (
    <div className="px-4">
      <p className="mb-2 flex items-center justify-between font-ui text-caption uppercase tracking-wide text-ink-3">
        <span>Filed automatically</span>
        {onUndo && (
          <button type="button" onClick={onUndo} className="flex items-center gap-1 normal-case text-ink-3">
            <Undo2 size={13} strokeWidth={1.5} aria-hidden /> undo
          </button>
        )}
      </p>
      <ul className="divide-y divide-line border-y border-line">
        {proposals.map((p) => {
          const view = displayProposal(p);
          const value = formatPrimary(view.primary);
          return (
            <li key={p.proposalId} className="flex items-center gap-3 px-1 py-2.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-chip ${DOMAIN_DOT[view.domain]}`} aria-hidden />
              <Check size={14} strokeWidth={2} className="shrink-0 text-ok" aria-hidden />
              <span className="flex-1 truncate font-ui text-body text-ink-2">{view.title}</span>
              {value && <span className="shrink-0 font-ui text-caption tabular-nums text-ink-3">{value}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
