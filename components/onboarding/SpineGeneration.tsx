"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/app/lib/utils";
import { DOMAIN_DOT, DOMAIN_LABEL } from "@/components/today/domain";
import type { CoreAnswers, SpineDomain } from "@/core/onboarding";

import { MOTION } from "./motion";
import { requestSpine, type SpineOutcome } from "./spineClient";

/*
 * SpineGeneration — SAR-012 Pass 2, Phase C (§5). The first "wow": the selected domain
 * chips orbit a center "Drafting your plans…" label while the deep tier generates each
 * spine in PARALLEL (one call per domain, 8s budget each). Each chip resolves INDEPENDENTLY
 * (a tick when done, a retry glyph if it failed/overran) — one slow domain never blocks the
 * others. When all have settled, the ordered outcomes advance to Phase D (Confirm), where a
 * failed domain renders its retry skeleton. Reduced motion: the ring holds still (no orbit).
 * Tokens only — domain hues + neutral ink; NO amber (this isn't an earned moment yet).
 */

const ORBIT_PX = 220;
const RADIUS = 96;

type Status = "loading" | "done" | "failed";

function orbitPosition(index: number, count: number): { left: number; top: number } {
  // Evenly spaced around the ring, starting at the top (−90°).
  const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
  return {
    left: ORBIT_PX / 2 + RADIUS * Math.cos(angle),
    top: ORBIT_PX / 2 + RADIUS * Math.sin(angle),
  };
}

function OrbitChip({ domain, status }: { domain: SpineDomain; status: Status }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-chip border bg-card px-3 py-1.5 font-ui text-caption text-ink-1 transition-opacity duration-[var(--t-base)]",
        status === "loading" ? "border-line animate-onboarding-pulse" : "border-line",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-chip", DOMAIN_DOT[domain])} aria-hidden />
      <span>{DOMAIN_LABEL[domain]}</span>
      {status === "done" && <Check size={14} strokeWidth={2} className="text-ink-3" aria-hidden />}
      {status === "failed" && <RotateCw size={14} strokeWidth={2} className="text-ink-3" aria-hidden />}
    </div>
  );
}

export function SpineGeneration({
  answers,
  domains,
  onComplete,
}: {
  answers: CoreAnswers;
  domains: SpineDomain[];
  onComplete: (outcomes: SpineOutcome[]) => void;
}) {
  const reduce = useReducedMotion();
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });
  const [statuses, setStatuses] = useState<Record<string, Status>>(() =>
    Object.fromEntries(domains.map((domain) => [domain, "loading" as Status])),
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      domains.map(async (domain) => {
        const outcome = await requestSpine(domain, answers);
        if (!cancelled) setStatuses((prev) => ({ ...prev, [domain]: outcome.status }));
        return outcome;
      }),
    ).then((outcomes) => {
      if (!cancelled) onCompleteRef.current(outcomes);
    });
    return () => {
      cancelled = true;
    };
  }, [answers, domains]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-10">
      <div className="relative" style={{ width: ORBIT_PX, height: ORBIT_PX }}>
        {/* The orbiting ring — a hairline circle with one highlighted arc that revolves. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full border border-line"
          style={{ borderTopColor: "var(--ink-3)" }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={reduce ? undefined : { duration: MOTION.orbitSec, ease: "linear", repeat: Infinity }}
        />
        {/* The center label. */}
        <div className="absolute inset-0 flex items-center justify-center px-10 text-center">
          <p className="font-coach text-body leading-[var(--leading-coach)] on-art-dim">Drafting your plans…</p>
        </div>
        {/* The domain chips, upright, at even points on the ring — each resolves on its own. */}
        {domains.map((domain, index) => {
          const position = orbitPosition(index, domains.length);
          return (
            <div
              key={domain}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: position.left, top: position.top }}
            >
              <OrbitChip domain={domain} status={statuses[domain] ?? "loading"} />
            </div>
          );
        })}
      </div>
      <p className="mt-10 font-ui text-caption uppercase tracking-wide on-art">From your answers</p>
    </div>
  );
}
