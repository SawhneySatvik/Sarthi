"use client";

import { useTransition } from "react";

import { setItemStatus } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { TodayItem } from "@/core/domains/today";

import { DOMAIN_DOT } from "./domain";

/** The single NEXT UP card — the only card that shows Done/Skip (SCREEN-TODAY). */
export function NextUpCard({ item }: { item: TodayItem }) {
  const [pending, startTransition] = useTransition();

  function act(status: "done" | "skipped") {
    startTransition(() => {
      void setItemStatus(item.id, status);
    });
  }

  return (
    <Card className="flex flex-col gap-4">
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
        <Button variant="primary" disabled={pending} onClick={() => act("done")}>
          Done
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => act("skipped")}>
          Skip
        </Button>
      </div>
    </Card>
  );
}
