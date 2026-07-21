"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";

import { setItemStatus } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/Button";
import { ArtFrame } from "@/components/art/ArtFrame";
import { selectPlanArt } from "@/components/art/registry";
import type { TodayItem } from "@/core/domains/today";

import { DOMAIN_DOT } from "./domain";

/** The single NEXT UP card — the only card that shows Done/Skip (SCREEN-TODAY). */
export function NextUpCard({ item }: { item: TodayItem }) {
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);

  function act(status: "done" | "skipped") {
    startTransition(() => {
      void setItemStatus(item.id, status).then(() => {
        window.dispatchEvent(new CustomEvent("sarthi:capture-context", { detail: { prompt: "How'd it go?" } }));
      });
    });
  }

  const artKey = selectPlanArt(item.domain, item.title);

  const swipeProps = {
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (pending) return;
      if (event.key.toLowerCase() === "d" || event.key === "ArrowRight") { event.preventDefault(); act("done"); }
      if (event.key.toLowerCase() === "s" || event.key === "ArrowLeft") { event.preventDefault(); act("skipped"); }
    },
  };

  const content = <NextUpContent item={item} pending={pending} onAct={act} imageBacked={Boolean(artKey)} />;
  const framed = artKey ? <ArtFrame artKey={artKey} eager className="min-h-52 shadow-[var(--elev-card)] lg:min-h-40"><div className="flex h-full flex-col justify-end gap-4 p-4 lg:gap-2 lg:p-3">{content}</div></ArtFrame> : content;

  return <motion.div tabIndex={0} {...swipeProps} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.16} whileDrag={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 360, damping: 26 }} onDragStart={() => setDragging(true)} onDragEnd={(_, info) => { setDragging(false); if (!pending && Math.abs(info.offset.x) >= 72) act(info.offset.x > 0 ? "done" : "skipped"); }} className="relative touch-pan-y focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <AnimatePresence>{dragging && <>
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center px-4 font-ui text-caption text-ink-1">Skip</motion.span>
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center px-4 font-ui text-caption text-ink-1">Done</motion.span>
    </>}</AnimatePresence>
    <div className="relative z-10">{framed}</div>
  </motion.div>;
}

function NextUpContent({ item, pending, onAct, imageBacked = false }: { item: TodayItem; pending: boolean; onAct: (status: "done" | "skipped") => void; imageBacked?: boolean }) {
  return (
    <div className={imageBacked ? "flex flex-col gap-4 lg:gap-2" : "flex flex-col gap-4 rounded-card border border-line bg-card p-4 shadow-[var(--elev-card)] lg:gap-2 lg:p-3"}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-chip ${DOMAIN_DOT[item.domain]}`} aria-hidden />
        <div>
          <p className={`font-display text-title ${imageBacked ? "on-art" : "text-ink-1"}`}>{item.title}</p>
          {item.targetValue !== null && (
            <p className={`mt-1 font-ui text-caption tabular-nums ${imageBacked ? "on-art-dim" : "text-ink-2"}`}>
              {item.targetValue}
              {item.targetUnit ? ` ${item.targetUnit}` : ""}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2" aria-label="Task actions. Swipe right to mark done, left to skip.">
        <Button variant="ghost" disabled={pending} onClick={() => onAct("skipped")}>
          Skip
        </Button>
        <Button variant="primary" disabled={pending} onClick={() => onAct("done")}>
          Done
        </Button>
      </div>
    </div>
  );
}
