"use client";

import { RotateCw } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/app/lib/utils";
import { DOMAIN_DOT, DOMAIN_LABEL } from "@/components/today/domain";
import type { CoreAnswers, DomainSpine, SpineDomain } from "@/core/onboarding";

import { SpineCard } from "./SpineCard";
import { requestSpine, type SpineOutcome } from "./spineClient";

/*
 * ConfirmCards — SAR-012 Pass 2, Phase D (§6). The stacked review (not a deck): one card
 * per selected domain. A resolved domain renders an editable SpineCard; a domain that
 * failed/overran (§10) renders a retry skeleton that retries JUST that domain — the others
 * stand. Editing stays client-local; NOTHING is written until the earned `Looks right —
 * start Day 1` tap (invariant #1), the single amber (`--energy`) moment on the screen
 * (D-041 sanctions amber here). The CTA is enabled once ≥1 spine has resolved.
 */

type CardState =
  | { status: "done"; spine: DomainSpine }
  | { status: "failed" }
  | { status: "retrying" };

function RetrySkeleton({
  domain,
  retrying,
  onRetry,
}: {
  domain: SpineDomain;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-card">
      <span className={cn("absolute inset-y-0 left-0 w-1 opacity-40", DOMAIN_DOT[domain])} aria-hidden />
      <div className="pl-5 pr-4 py-4">
        <p className="font-ui text-caption uppercase tracking-wide text-ink-2">{DOMAIN_LABEL[domain]}</p>
        {retrying ? (
          <div className="mt-3 space-y-2" aria-hidden>
            <div className="h-4 w-3/4 rounded-input bg-raised animate-onboarding-pulse" />
            <div className="h-4 w-1/2 rounded-input bg-raised animate-onboarding-pulse" />
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="font-coach text-body text-ink-2">Couldn&rsquo;t draft this one.</p>
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-2 rounded-chip border border-line px-3 py-1.5 font-ui text-caption text-ink-1"
            >
              <RotateCw size={14} strokeWidth={2} aria-hidden />
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function ConfirmCards({
  answers,
  domains,
  outcomes,
  onAccept,
  accepting,
}: {
  answers: CoreAnswers;
  domains: SpineDomain[];
  outcomes: SpineOutcome[];
  onAccept: (spines: DomainSpine[]) => void;
  accepting: boolean;
}) {
  const [cards, setCards] = useState<Record<string, CardState>>(() => {
    const initial: Record<string, CardState> = {};
    for (const outcome of outcomes) {
      initial[outcome.domain] = outcome.status === "done" ? { status: "done", spine: outcome.spine } : { status: "failed" };
    }
    return initial;
  });

  const retry = useCallback(
    async (domain: SpineDomain) => {
      setCards((prev) => ({ ...prev, [domain]: { status: "retrying" } }));
      const outcome = await requestSpine(domain, answers);
      setCards((prev) => ({
        ...prev,
        [domain]: outcome.status === "done" ? { status: "done", spine: outcome.spine } : { status: "failed" },
      }));
    },
    [answers],
  );

  const update = useCallback((domain: SpineDomain, spine: DomainSpine) => {
    setCards((prev) => ({ ...prev, [domain]: { status: "done", spine } }));
  }, []);

  const doneSpines = domains
    .map((domain) => cards[domain])
    .filter((card): card is { status: "done"; spine: DomainSpine } => card?.status === "done")
    .map((card) => card.spine);
  const canAccept = doneSpines.length > 0 && !accepting;

  return (
    <div className="flex flex-1 flex-col pb-10">
      {/* On the full-bleed backdrop (UIE-5) — light on-art inks for AA over `--scrim-art`. */}
      <h1 className="font-display text-display on-art">Here&rsquo;s your start.</h1>
      <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] on-art-dim">
        Tweak anything — nothing is saved until you start Day 1.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {domains.map((domain) => {
          const card = cards[domain];
          if (card?.status === "done") {
            return (
              <SpineCard
                key={domain}
                spine={card.spine}
                onChange={(next) => update(domain, next)}
                onRegenerate={() => retry(domain)}
              />
            );
          }
          return (
            <RetrySkeleton
              key={domain}
              domain={domain}
              retrying={card?.status === "retrying"}
              onRetry={() => retry(domain)}
            />
          );
        })}
      </div>

      {/* The earned moment — the ONLY amber on this screen (invariant #4 / D-041). */}
      <button
        type="button"
        disabled={!canAccept}
        onClick={() => onAccept(doneSpines)}
        className="mt-8 w-full rounded-chip bg-energy px-4 py-3 font-ui text-body text-canvas [[data-mode=light]_&]:text-ink-1 transition-opacity duration-[var(--t-base)] disabled:opacity-50"
      >
        {accepting ? "Starting…" : "Looks right — start Day 1"}
      </button>
    </div>
  );
}
