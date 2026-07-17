"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, Pencil, X } from "lucide-react";
import { useRef, useState } from "react";

import type { Proposal } from "@/core/capture/contract";
import { applyUserEdit } from "@/core/capture/route";

import { DOMAIN_DOT, DOMAIN_LABEL } from "../today/domain";
import { MOTION } from "./motion";
import { displayProposal, formatPrimary, toStored } from "./proposalText";

/*
 * One estimate-deck card (SAR-006, D-D). The four gestures: accept (swipe-right / ✓),
 * discard (swipe-left / ✕), edit (✎ → inline field → save = accept), why (long-press
 * or the "why?" footer → flip to the Fraunces basis). A blocked card (its question is
 * unanswered) refuses accept/edit. Mirror buttons give the gestures an a11y path.
 */
export function EstimateCard({
  proposal,
  blocked,
  onAccept,
  onDiscard,
}: {
  proposal: Proposal;
  blocked: boolean;
  onAccept: (proposal: Proposal) => void;
  onDiscard: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const view = displayProposal(proposal);
  const [draft, setDraft] = useState(view.primary?.value != null ? String(view.primary.value) : "");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function accept() {
    if (editing && view.primary) {
      const n = Number(draft);
      if (Number.isFinite(n) && draft.trim() !== "") {
        onAccept(applyUserEdit(proposal, { [view.primary.editKey]: toStored(view.primary, n) }));
        return;
      }
    }
    onAccept(proposal);
  }

  function startHold() {
    holdTimer.current = setTimeout(() => setFlipped(true), MOTION.holdToFlipMs);
  }
  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }

  const confidencePct = Math.round(proposal.confidenceBps / 100);

  return (
    <motion.div
      style={{ x: blocked ? undefined : x, rotate: blocked ? undefined : rotate }}
      drag={blocked || editing ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragStart={cancelHold}
      onDragEnd={(_, info) => {
        if (info.offset.x > MOTION.swipeThreshold) accept();
        else if (info.offset.x < -MOTION.swipeThreshold) onDiscard();
      }}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      className={`rounded-card border border-line bg-card p-5 shadow-[var(--elev-card)] ${blocked ? "opacity-60" : ""}`}
    >
      {flipped ? (
        <button type="button" onClick={() => setFlipped(false)} className="block w-full text-left">
          <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Why this number</p>
          <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{proposal.why.basis}</p>
          {proposal.why.assumptions.length > 0 && (
            <ul className="mt-2 list-disc pl-4 font-ui text-caption text-ink-2">
              {proposal.why.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 font-ui text-caption text-ink-3">tap to flip back</p>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-chip ${DOMAIN_DOT[view.domain]}`} aria-hidden />
              <span className="font-ui text-caption text-ink-2">{DOMAIN_LABEL[view.domain]}</span>
            </span>
            <span className="font-ui text-caption tabular-nums text-ink-3">{confidencePct}%</span>
          </div>
          <p className="mt-3 font-display text-title text-ink-1">{view.title}</p>
          {view.primary &&
            (editing ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label={view.primary.label}
                  className="w-24 rounded-input border border-line bg-raised px-2 py-1 font-ui text-body tabular-nums text-ink-1"
                />
                <span className="font-ui text-caption text-ink-2">{view.primary.unit}</span>
              </div>
            ) : (
              <p className="mt-1 font-ui text-body tabular-nums text-ink-2">{formatPrimary(view.primary)}</p>
            ))}
          {view.statusToggle && <p className="mt-1 font-ui text-body text-ink-2">Marked {view.statusToggle}</p>}
          <div className="mt-3 flex items-center gap-2 font-ui text-caption text-ink-3">
            {proposal.estimated && <span className="rounded-chip border border-line px-2 py-0.5">estimated</span>}
            <button type="button" onClick={() => setFlipped(true)} className="underline">
              why?
            </button>
          </div>
        </>
      )}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          aria-label="Discard"
          onClick={onDiscard}
          disabled={blocked}
          className="flex h-11 w-11 items-center justify-center rounded-chip border border-line text-ink-2 disabled:opacity-40"
        >
          <X size={20} strokeWidth={1.5} aria-hidden />
        </button>
        {view.primary && (
          <button
            type="button"
            aria-label={editing ? "Editing" : "Edit"}
            onClick={() => setEditing((e) => !e)}
            disabled={blocked}
            className={`flex h-11 w-11 items-center justify-center rounded-chip border text-ink-2 disabled:opacity-40 ${editing ? "border-ink-2" : "border-line"}`}
          >
            <Pencil size={18} strokeWidth={1.5} aria-hidden />
          </button>
        )}
        <button
          type="button"
          aria-label={editing ? "Save" : "Accept"}
          onClick={accept}
          disabled={blocked}
          className="flex h-11 w-11 items-center justify-center rounded-chip bg-ink-1 text-canvas disabled:opacity-40"
        >
          <Check size={20} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      {blocked && <p className="mt-2 text-center font-ui text-caption text-ink-3">answer the question above first</p>}
    </motion.div>
  );
}
