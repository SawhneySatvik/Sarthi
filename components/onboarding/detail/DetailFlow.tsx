"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { OnboardingDetailInput } from "@/core/onboarding";

import { MOTION } from "../motion";
import { E1Food } from "./sections/E1Food";
import { E2Screen } from "./sections/E2Screen";
import { E3Focus } from "./sections/E3Focus";
import { E4Career } from "./sections/E4Career";
import { E5Money } from "./sections/E5Money";

/*
 * DetailFlow — SAR-012 Pass 3, Phase E (§7). The order-free section grid: five cards a user
 * can cherry-pick in any order, `Done` exits at any time. Answering a section POSTs the typed
 * patch to /api/onboarding/detail (which resolves that section's `profile_gap`); skipping just
 * returns to the grid and LEAVES the gap open for the SAR-014 backfill. Nothing here creates a
 * gap. The profile is already `complete` (D-accept), so a reload would route to Today — E is
 * post-completion polish, and its progress lives only in this ephemeral client state.
 */
type SectionId = "food" | "screen" | "focus" | "career" | "money";

const SECTIONS: ReadonlyArray<{ id: SectionId; label: string; hint: string }> = [
  { id: "food", label: "Food pattern", hint: "veg · non-veg · how you eat" },
  { id: "screen", label: "Screen time", hint: "an honest daily number" },
  { id: "focus", label: "Focus", hint: "how your attention runs" },
  { id: "career", label: "Career & skills", hint: "your work and level" },
  { id: "money", label: "Money picture", hint: "income and fixed bills" },
];

export function DetailFlow({ skillName, onDone }: { skillName: string | null; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<SectionId | null>(null);
  const [answered, setAnswered] = useState<ReadonlySet<SectionId>>(new Set());
  const [saving, setSaving] = useState(false);

  const backToGrid = useCallback(() => setOpen(null), []);

  const submit = useCallback(async (payload: OnboardingDetailInput) => {
    setSaving(true);
    let ok = false;
    try {
      const response = await fetch("/api/onboarding/detail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      ok = response.ok;
    } catch {
      ok = false;
    }
    setSaving(false);
    if (ok && payload.section !== "theme") {
      const section = payload.section;
      setAnswered((prev) => new Set(prev).add(section));
      setOpen(null);
    }
    // On failure the section stays open so the user can retry (zero side effects committed).
  }, []);

  function renderOpen(id: SectionId) {
    switch (id) {
      case "food":
        return <E1Food onSave={submit} onSkip={backToGrid} saving={saving} />;
      case "screen":
        return <E2Screen onSave={submit} onSkip={backToGrid} saving={saving} />;
      case "focus":
        return <E3Focus onSave={submit} onSkip={backToGrid} saving={saving} />;
      case "career":
        return <E4Career skillName={skillName} onSave={submit} onSkip={backToGrid} saving={saving} />;
      case "money":
        return <E5Money onSave={submit} onSkip={backToGrid} saving={saving} />;
    }
  }

  const grid = (
    <div className="flex flex-1 flex-col pb-10">
      <h1 className="font-display text-display text-ink-1">Sharpen the coach.</h1>
      <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
        Any order — answer what you like, skip the rest.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {SECTIONS.map((section) => {
          const done = answered.has(section.id);
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setOpen(section.id)}
              className="flex items-center gap-3 rounded-card border border-line bg-card px-4 py-3.5 text-left"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  done ? "border-transparent bg-ink-1 text-canvas" : "border-line text-ink-2"
                }`}
                aria-hidden
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-ui text-body text-ink-1">{section.label}</span>
                <span className="block font-ui text-caption text-ink-2">{done ? "Saved" : section.hint}</span>
              </span>
              <ChevronRight size={18} strokeWidth={1.5} className="shrink-0 text-ink-3" aria-hidden />
            </button>
          );
        })}
      </div>

      <Button className="mt-8 w-full min-h-11" onClick={onDone}>
        Done
      </Button>
    </div>
  );

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={open ?? "grid"}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.risePx }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -MOTION.risePx }}
        transition={{ duration: MOTION.crossfadeSec, ease: MOTION.ease }}
        className="flex flex-1 flex-col"
      >
        {open ? renderOpen(open) : grid}
      </motion.div>
    </AnimatePresence>
  );
}
