import { Check } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { ArtFrame } from "@/components/art/ArtFrame";
import type { TodayItem, TodayView } from "@/core/domains/today";

import { ArcCompleteCard, ArcSettledBanner } from "./ArcCompleteCard";
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

function LaterRow({ item, index }: { item: TodayItem; index: number }) {
  // Calm per-row entrance stagger (small, not bouncy). Keyed by item.id upstream, so a
  // Done/Skip revalidation keeps stable rows mounted → `once` never replays their reveal;
  // NextUpCard's drag/Done/Skip logic is untouched (the motion sits one level up on the <li>).
  return (
    <Reveal as="li" delay={0.05 + Math.min(index, 6) * 0.04}>
      <NextUpCard item={item} />
    </Reveal>
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
      <ArtFrame artKey="today.done_evening" eager className="min-h-56">
      <Card className="flex h-full flex-col items-center justify-end gap-2 bg-transparent text-center shadow-none">
        <Check size={26} strokeWidth={1.5} aria-hidden className="text-ok" />
        <p className="font-display text-title on-art">All done for today</p>
        <p className="font-ui text-body on-art-dim">Every planned item is complete. Rest well.</p>
        <Link href="/coach" className="mt-2 inline-flex min-h-11 items-center font-ui text-body on-art underline decoration-line underline-offset-4">View recap</Link>
      </Card>
      </ArtFrame>
    </div>
  );
}

/**
 * The plan spine: the arc-complete celebration (UIE-0e S1), else the settled banner (S2) atop
 * the normal day-state body — NEXT UP (one card) → LATER TODAY → COMPLETED, or a day-state note.
 */
export function PlanSpine({ view }: { view: TodayView }) {
  if (view.state === "arc-complete" && view.arcComplete) {
    return <ArcCompleteCard summary={view.arcComplete} stat={view.stat} />;
  }
  return (
    <>
      {view.settledArc && <ArcSettledBanner summary={view.settledArc} />}
      <SpineBody view={view} />
    </>
  );
}

function SpineBody({ view }: { view: TodayView }) {
  if (view.state === "new-user") {
    return <EmptyNote title="No arcs yet" body="Your plan appears here once your first arc begins." />;
  }
  if (view.state === "nothing-planned") {
    return <div className="px-4 pt-8"><ArtFrame artKey="today.rest" eager className="min-h-56"><div className="flex h-full flex-col justify-end p-5"><p className="font-display text-title on-art">Nothing planned today</p><p className="mt-2 font-ui text-body on-art-dim">Enjoy the open day - or capture something to begin.</p></div></ArtFrame></div>;
  }
  if (view.state === "all-done") {
    return <AllDone />;
  }
  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      {view.nextUp && (
        <Reveal as="section">
          <SectionLabel>Next up</SectionLabel>
          <NextUpCard item={view.nextUp} />
        </Reveal>
      )}
      {view.laterToday.length > 0 && (
        // The section itself stays static; only its rows stagger in (no nested reveals).
        <section>
          <SectionLabel>Remaining today</SectionLabel>
          <ul className="flex flex-col gap-2">
            {view.laterToday.map((item, index) => (
              <LaterRow key={item.id} item={item} index={index} />
            ))}
          </ul>
        </section>
      )}
      {view.completed.length > 0 && (
        <Reveal as="section" delay={0.1}>
          <SectionLabel>Completed</SectionLabel>
          <ul className="flex flex-col gap-1">
            {view.completed.map((item) => (
              <CompletedRow key={item.id} item={item} />
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
