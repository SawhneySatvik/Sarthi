"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReceiptText, Utensils } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { CommitResult } from "@/core/capture/commit";
import type { CaptureDraft, ClarificationQuestion, Proposal } from "@/core/capture/contract";
import { ACCEPT_ALL_MIN_CONFIDENCE_BPS, blockedProposalIds, routeDraft } from "@/core/capture/route";

import { DOMAIN_DOT } from "../today/domain";
import { CaptureOrb } from "./CaptureOrb";
import { commitProposals, parsePhoto, parseText, undoCommit, type CommitResponse } from "./captureClient";
import { EstimateDeck } from "./EstimateDeck";
import { FiledStrip } from "./FiledStrip";
import { LevelUpBloom } from "./LevelUpBloom";
import { MOTION } from "./motion";
import { ParseShimmer } from "./ParseShimmer";
import { displayProposal, formatPrimary } from "./proposalText";
import { QuestionCard } from "./QuestionCard";

type Phase = "preview" | "parsing" | "confirm" | "error";
type PhotoType = "meal" | "receipt";

/** The capture sheet's input — text (voice/typed) or a picked/snapped photo (SAR-011). */
export type CaptureInput = { mode: "text"; text: string } | { mode: "photo"; file: File };

/*
 * The capture sheet orchestrator (SAR-006 · SAR-011). Runs FLOWS F3/F5 over the
 * route-handler seam: parse → route-by-confidence → auto-file strip + estimate deck →
 * per-card accept/discard/edit/why → fan-out → 5-min undo. SAR-011 adds the PHOTO ramp
 * as a new front end: a `preview` phase (thumbnail + meal/receipt toggle) → `parsePhoto`
 * (fake vision, keyless) → the IDENTICAL post-parse flow (`ingestDraft`). Photo-derived
 * proposals never auto-write (the evidence routing rule pends them), so for a photo the
 * strip is correctly empty — everything surfaces as a confirm card (invariant #1).
 */
export function CaptureSheet({ input, onClose }: { input: CaptureInput; onClose: () => void }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(input.mode === "photo" ? "preview" : "parsing");
  const [photoType, setPhotoType] = useState<PhotoType>("meal");
  // Client-only thumbnail — created once at mount (lazy init, never a setState-in-effect),
  // never uploaded or persisted; revoked on close by the cleanup effect below.
  const [previewUrl] = useState<string | null>(() =>
    input.mode === "photo" ? URL.createObjectURL(input.file) : null,
  );
  const [strip, setStrip] = useState<Proposal[]>([]);
  const [autoCommitId, setAutoCommitId] = useState<string | null>(null);
  const [deck, setDeck] = useState<Proposal[]>([]);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [xpGained, setXpGained] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [lastCommitId, setLastCommitId] = useState<string | null>(null);
  const [wroteAnything, setWroteAnything] = useState(false);
  const [confirmed, setConfirmed] = useState<Proposal[]>([]);
  const mountedRef = useRef(true);

  const photoLabel = photoType === "receipt" ? "Receipt photo" : "Meal photo";

  function recordCommit(result: CommitResult) {
    setXpGained((v) => v + result.progressEffects.reduce((s, e) => s + e.xpDelta, 0));
    if (result.progressEffects.some((e) => e.levelAfter > e.levelBefore)) setLeveledUp(true);
    setLastCommitId(result.commitId);
    setWroteAnything(true);
    router.refresh();
  }

  /** Fold a commit response's `unresolved` back into the deck (+ any demotion question). */
  function redeck(source: readonly Proposal[], res: CommitResponse) {
    const list = res.unresolved ?? [];
    if (list.length === 0) return;
    const ids = new Set(list.map((u) => u.proposalId));
    const back = source.filter((p) => ids.has(p.proposalId));
    setDeck((d) => [...back.filter((p) => !d.some((x) => x.proposalId === p.proposalId)), ...d]);
    const qs = list.map((u) => u.question).filter((q): q is ClarificationQuestion => q !== null);
    if (qs.length) {
      setQuestions((prev) => [...prev, ...qs.filter((q) => !prev.some((x) => x.questionId === q.questionId))]);
    }
  }

  /*
   * The SHARED post-parse routine for BOTH input modes — route the draft, silently
   * auto-file the genuinely-auto batch (server re-routes as defense in depth), deck
   * the rest, and fold back anything the server refused. `isActive()` guards a late
   * setState after the sheet unmounts. This is the F3 code path, byte-for-byte.
   */
  async function ingestDraft(draft: CaptureDraft, isActive: () => boolean) {
    const routed = routeDraft(draft);
    const autoIds = new Set(routed.filter((r) => r.route === "auto").map((r) => r.proposalId));
    const auto = draft.proposals.filter((p) => autoIds.has(p.proposalId));
    setDeck(draft.proposals.filter((p) => !autoIds.has(p.proposalId)));
    setQuestions([...draft.questions]);
    setPhase("confirm");
    if (auto.length === 0) return;

    const commit = await commitProposals(auto, "auto");
    if (!isActive()) return;
    const unresolvedIds = new Set((commit.unresolved ?? []).map((u) => u.proposalId));
    // The strip shows ONLY what actually committed — never a phantom "filed" row.
    setStrip(commit.result ? auto.filter((p) => !unresolvedIds.has(p.proposalId)) : []);
    if (commit.result) {
      const result = commit.result;
      setAutoCommitId(result.commitId);
      setXpGained((v) => v + result.progressEffects.reduce((s, e) => s + e.xpDelta, 0));
      if (result.progressEffects.some((e) => e.levelAfter > e.levelBefore)) setLeveledUp(true);
      setLastCommitId(result.commitId);
      setWroteAnything(true);
      router.refresh();
    }
    // Re-deck anything that did NOT commit: the server-refused subset, or — on a total
    // failure — every auto proposal, so an entry is never lost from the UI (R1).
    const backIds = commit.result ? unresolvedIds : new Set(auto.map((p) => p.proposalId));
    const back = auto.filter((p) => backIds.has(p.proposalId));
    if (back.length > 0) {
      setDeck((d) => [...back.filter((p) => !d.some((x) => x.proposalId === p.proposalId)), ...d]);
    }
    const qs = (commit.unresolved ?? []).map((u) => u.question).filter((q): q is ClarificationQuestion => q !== null);
    if (qs.length > 0) setQuestions((prev) => [...prev, ...qs.filter((q) => !prev.some((x) => x.questionId === q.questionId))]);
  }

  // Track mount so the user-triggered photo analyze can guard a late setState.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Revoke the preview object URL when the sheet closes — no blob outlives the sheet.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Text mode parses on open; photo mode waits for the user to pick a type and Analyze.
  useEffect(() => {
    if (input.mode !== "text") return;
    let cancelled = false;
    void (async () => {
      const res = await parseText(input.text);
      if (cancelled) return;
      if (!res.ok || !res.draft) {
        setPhase("error");
        return;
      }
      await ingestDraft(res.draft, () => !cancelled);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyzePhoto() {
    if (input.mode !== "photo") return;
    setPhase("parsing");
    const res = await parsePhoto(input.file, photoType);
    if (!mountedRef.current) return;
    if (!res.ok || !res.draft) {
      setPhase("error");
      return;
    }
    await ingestDraft(res.draft, () => mountedRef.current);
  }

  const blockedIds = blockedProposalIds({ questions });

  async function acceptCard(proposal: Proposal) {
    setDeck((d) => d.filter((x) => x.proposalId !== proposal.proposalId)); // optimistic toss
    const res = await commitProposals([proposal], "accept", "tap");
    if (res.ok && res.result) {
      recordCommit(res.result);
      setConfirmed((c) => [...c, proposal]);
      return;
    }
    // Resolution failed → the card comes back (never vanishes) + its demotion question.
    setDeck((d) => (d.some((x) => x.proposalId === proposal.proposalId) ? d : [proposal, ...d]));
    redeck([proposal], res);
  }

  function discardCard(proposalId: string) {
    setDeck((d) => d.filter((x) => x.proposalId !== proposalId));
  }

  async function acceptAll() {
    const eligible = deck.filter(
      (p) => !blockedIds.has(p.proposalId) && p.confidenceBps >= ACCEPT_ALL_MIN_CONFIDENCE_BPS,
    );
    if (eligible.length === 0) return;
    const eligibleIds = new Set(eligible.map((p) => p.proposalId));
    setDeck((d) => d.filter((p) => !eligibleIds.has(p.proposalId))); // optimistic
    const res = await commitProposals(eligible, "accept");
    const refusedIds = new Set((res.unresolved ?? []).map((u) => u.proposalId));
    if (res.ok && res.result) {
      recordCommit(res.result);
      setConfirmed((c) => [...c, ...eligible.filter((p) => !refusedIds.has(p.proposalId))]);
    }
    redeck(eligible, res);
    if (!res.ok && refusedIds.size === 0) {
      // Transport/400 failure with no per-item info → put every eligible card back (R1).
      setDeck((d) => [...eligible.filter((p) => !d.some((x) => x.proposalId === p.proposalId)), ...d]);
    }
  }

  async function undoAuto() {
    if (!autoCommitId) return;
    const res = await undoCommit(autoCommitId);
    if (!res.ok) return; // superseded/expired → keep the strip; the write stands
    setStrip([]);
    setAutoCommitId(null);
    setLastCommitId(null);
    setWroteAnything(false);
    router.refresh();
  }

  async function undoLast() {
    if (lastCommitId) await undoCommit(lastCommitId);
    router.refresh();
    onClose();
  }

  const done = phase === "confirm" && deck.length === 0 && questions.length === 0;
  // Strip-undo is valid only while the auto batch is still the latest committed one.
  const stripUndoable = autoCommitId !== null && lastCommitId === autoCommitId;

  return (
    <motion.div
      initial={reduce ? false : { y: "100%" }}
      animate={{ y: 0 }}
      exit={reduce ? undefined : { y: "100%" }}
      transition={{ type: "tween", duration: MOTION.sheetSlideSec }}
      className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-card border-t border-line bg-raised pb-8 pt-4 shadow-[var(--elev-card)]"
      role="dialog"
      aria-label="Capture"
    >
      <div className="mx-auto flex max-w-[45rem] flex-col gap-5">
        <div className="flex items-center justify-between px-4">
          <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Capture</p>
          <button type="button" onClick={onClose} className="-mr-2 px-2 py-1.5 font-ui text-caption text-ink-2">
            Close
          </button>
        </div>

        {input.mode === "photo" ? (
          // The large preview (below) covers the photo during `preview`; showing this
          // small header thumbnail then would render the photo twice (#9/#10). Keep it
          // for `parsing`/`confirm`, where the large preview is gone, as context. A rect
          // radius (not a circular chip) never crops a tall receipt like an avatar.
          phase !== "preview" && (
            <div className="flex items-center gap-3 px-4">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Photo preview"
                  className="h-12 w-12 shrink-0 rounded-[var(--r-input)] border border-line object-cover"
                />
              )}
              <p className="font-ui text-caption uppercase tracking-wide text-ink-3">{photoLabel}</p>
            </div>
          )
        ) : (
          <p className="px-4 font-coach text-body leading-[var(--leading-coach)] text-ink-2">“{input.text}”</p>
        )}

        {phase === "preview" && input.mode === "photo" && (
          <div className="flex flex-col gap-4 px-4">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Selected photo"
                className="max-h-64 w-full rounded-card border border-line object-cover"
              />
            )}
            <div>
              <p className="mb-2 font-ui text-caption uppercase tracking-wide text-ink-3">What is this?</p>
              <div className="flex gap-1 rounded-chip border border-line p-1" role="group" aria-label="Photo type">
                {(["meal", "receipt"] as const).map((t) => {
                  const active = photoType === t;
                  const Icon = t === "meal" ? Utensils : ReceiptText;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPhotoType(t)}
                      className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-chip px-3 py-3 font-ui text-body capitalize ${
                        active ? "bg-ink-1 text-canvas" : "text-ink-2"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.5} aria-hidden />
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button className="w-full capitalize" onClick={analyzePhoto}>
              Analyze {photoType}
            </Button>
          </div>
        )}

        {phase === "parsing" && (
          <>
            <CaptureOrb active />
            <ParseShimmer />
          </>
        )}

        {phase === "error" && (
          <div className="px-4">
            <p className="font-ui text-body text-ink-1">Couldn’t read that — give it another try.</p>
            <Button className="mt-3" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {phase === "confirm" && (
          <>
            <FiledStrip proposals={strip} onUndo={stripUndoable ? undoAuto : undefined} />
            {questions.map((q) => (
              <div key={q.questionId} className="px-4">
                <QuestionCard
                  question={q}
                  onSkip={() => setQuestions((qs) => qs.filter((x) => x.questionId !== q.questionId))}
                />
              </div>
            ))}
            <EstimateDeck
              proposals={deck}
              blockedIds={blockedIds}
              onAccept={acceptCard}
              onDiscard={discardCard}
              onAcceptAll={acceptAll}
            />
            {done && (
              <div className="px-4">
                {confirmed.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-1 font-ui text-caption uppercase tracking-wide text-ink-3">Confirmed by you</p>
                    <ul className="divide-y divide-line border-y border-line">
                      {confirmed.map((p) => {
                        const view = displayProposal(p);
                        const value = formatPrimary(view.primary);
                        return (
                          <li key={p.proposalId} className="flex items-center gap-3 px-1 py-2">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-chip ${DOMAIN_DOT[view.domain]}`} aria-hidden />
                            <span className="flex-1 truncate font-ui text-body text-ink-2">{view.title}</span>
                            {value && <span className="shrink-0 font-ui text-caption tabular-nums text-ink-3">{value}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {leveledUp && <LevelUpBloom />}
                {xpGained > 0 && <p className="text-center font-display text-title tabular-nums text-energy">+{xpGained} XP</p>}
                <p className="mt-2 text-center font-coach text-body text-ink-2">
                  {wroteAnything ? "Logged. Nice momentum." : "Nothing logged this time."}
                </p>
                <Button className="mt-4 w-full" onClick={onClose}>
                  Done
                </Button>
                {wroteAnything && lastCommitId && (
                  <button
                    type="button"
                    onClick={undoLast}
                    className="mt-2 w-full font-ui text-caption text-ink-3 underline"
                  >
                    Undo last (5 min)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
