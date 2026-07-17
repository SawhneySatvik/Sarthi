"use client";

import { useState } from "react";

import { Chip } from "@/components/ui/Chip";
import type { TodayDomain } from "@/core/domains/today";

const LABELS: Record<TodayDomain, string> = {
  health: "Health",
  money: "Money",
  habits: "Habits",
  skills: "Skills",
};

/*
 * The domain switcher chip bar. "All" shows the plan spine (passed as children);
 * a domain shows a LABELED PLACEHOLDER — the real per-domain lenses are SAR-008/9/10.
 */
export function DomainSwitcher({
  domains,
  children,
}: {
  domains: readonly TodayDomain[];
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<"all" | TodayDomain>("all");
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        <Chip active={selected === "all"} onClick={() => setSelected("all")}>
          All
        </Chip>
        {domains.map((domain) => (
          <Chip key={domain} active={selected === domain} onClick={() => setSelected(domain)}>
            {LABELS[domain]}
          </Chip>
        ))}
      </div>
      {selected === "all" ? (
        children
      ) : (
        <div className="px-4 pt-10 text-center">
          <p className="font-ui text-body text-ink-2">{LABELS[selected]} lens</p>
          <p className="mt-1 font-ui text-caption text-ink-3">
            The {LABELS[selected]} lens arrives in a later ticket.
          </p>
        </div>
      )}
    </div>
  );
}
