import { Check } from "lucide-react";

import { Card } from "@/components/ui/Card";
import type { TodayItem, TodayView } from "@/core/domains/today";

import { DOMAIN_DOT } from "./domain";
import { NextUpCard } from "./NextUpCard";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 font-ui text-caption uppercase tracking-wide text-ink-2">{children}</p>;
}

function ViaCaptureBadge() {
  return (
    <span className="shrink-0 rounded-chip border border-line px-1.5 py-0.5 font-ui text-caption text-ink-3">
      via capture
    </span>
  );
}

function LaterRow({ item }: { item: TodayItem }) {
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-card px-4 py-3">
      <span className={`h-2 w-2 shrink-0 rounded-chip ${DOMAIN_DOT[item.domain]}`} aria-hidden />
      <span className="flex-1 font-ui text-body text-ink-1">{item.title}</span>
      {item.viaCapture && <ViaCaptureBadge />}
    </li>
  );
}

function CompletedRow({ item }: { item: TodayItem }) {
  const done = item.status === "done";
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <Check size={16} strokeWidth={1.5} aria-hidden className={done ? "text-ok" : "text-ink-3"} />
      <span className="flex-1 font-ui text-body text-ink-3">{item.title}</span>
      {item.viaCapture && <ViaCaptureBadge />}
    </li>
  );
}

function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 pt-10 text-center">
      <p className="font-display text-title text-ink-1">{title}</p>
      <p className="mt-2 font-ui text-body text-ink-2">{body}</p>
    </div>
  );
}

function AllDone() {
  return (
    <div className="px-4 pt-8">
      <Card className="flex flex-col items-center gap-2 text-center">
        <Check size={26} strokeWidth={1.5} aria-hidden className="text-ok" />
        <p className="font-display text-title text-ink-1">All done for today</p>
        <p className="font-ui text-body text-ink-2">Every planned item is complete. Rest well.</p>
      </Card>
    </div>
  );
}

/** The plan spine: NEXT UP (one card) → LATER TODAY → COMPLETED, or a day-state note. */
export function PlanSpine({ view }: { view: TodayView }) {
  if (view.state === "new-user") {
    return <EmptyNote title="No arcs yet" body="Your plan appears here once your first arc begins." />;
  }
  if (view.state === "nothing-planned") {
    return <EmptyNote title="Nothing planned today" body="Enjoy the open day — or capture something to begin." />;
  }
  if (view.state === "all-done") {
    return <AllDone />;
  }
  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      {view.nextUp && (
        <section>
          <SectionLabel>Next up</SectionLabel>
          <NextUpCard item={view.nextUp} />
        </section>
      )}
      {view.laterToday.length > 0 && (
        <section>
          <SectionLabel>Later today</SectionLabel>
          <ul className="flex flex-col gap-2">
            {view.laterToday.map((item) => (
              <LaterRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
      {view.completed.length > 0 && (
        <section>
          <SectionLabel>Completed</SectionLabel>
          <ul className="flex flex-col gap-1">
            {view.completed.map((item) => (
              <CompletedRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
