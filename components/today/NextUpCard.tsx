"use client";

import { useTransition } from "react";

import { setItemStatus } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/Button";
import { ArtFrame } from "@/components/art/ArtFrame";
import { selectPlanArt } from "@/components/art/registry";
import type { TodayItem } from "@/core/domains/today";

import { DOMAIN_DOT } from "./domain";

/** The single NEXT UP card — the only card that shows Done/Skip (SCREEN-TODAY). */
export function NextUpCard({ item }: { item: TodayItem }) {
  const [pending, startTransition] = useTransition();

  function act(status: "done" | "skipped") {
    startTransition(() => {
      void setItemStatus(item.id, status).then(() => {
        window.dispatchEvent(new CustomEvent("sarthi:capture-context", { detail: { prompt: "How'd it go?" } }));
      });
    });
  }

  const artKey = selectPlanArt(item.domain, item.title);

  if (!artKey) {
    return <NextUpContent item={item} pending={pending} onAct={act} />;
  }

  return <ArtFrame artKey={artKey} eager className="min-h-52 shadow-[var(--elev-card)]">
    <div className="flex h-full flex-col justify-end gap-4 p-4">
      <NextUpContent item={item} pending={pending} onAct={act} imageBacked />
    </div>
  </ArtFrame>;
}

function NextUpContent({ item, pending, onAct, imageBacked = false }: { item: TodayItem; pending: boolean; onAct: (status: "done" | "skipped") => void; imageBacked?: boolean }) {
  return (
    <div className={imageBacked ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-card border border-line bg-card p-4 shadow-[var(--elev-card)]"}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-chip ${DOMAIN_DOT[item.domain]}`} aria-hidden />
        <div>
          <p className="font-display text-title text-ink-1">{item.title}</p>
          {item.targetValue !== null && (
            <p className="mt-1 font-ui text-caption text-ink-2 tabular-nums">
              {item.targetValue}
              {item.targetUnit ? ` ${item.targetUnit}` : ""}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" disabled={pending} onClick={() => onAct("done")}>
          Done
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => onAct("skipped")}>
          Skip
        </Button>
      </div>
    </div>
  );
}
