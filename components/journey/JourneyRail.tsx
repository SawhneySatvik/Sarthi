"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArtFrame } from "@/components/art/ArtFrame";
import { milestoneArt } from "@/components/art/registry";
import type { DisplayDomain, JourneyEvidence, JourneyView } from "@/core/game";

const domains: Record<DisplayDomain, { label: string; chipClass: string; captionClass: string; gradient: string }> = {
  health: { label: "Health", chipClass: "absolute left-3 top-3 rounded-chip bg-card px-2 py-1 font-ui text-caption text-health", captionClass: "mt-4 font-ui text-caption text-health", gradient: "linear-gradient(135deg, var(--dom-health), var(--bg-card))" },
  money: { label: "Money", chipClass: "absolute left-3 top-3 rounded-chip bg-card px-2 py-1 font-ui text-caption text-money", captionClass: "mt-4 font-ui text-caption text-money", gradient: "linear-gradient(135deg, var(--dom-money), var(--bg-card))" },
  habits: { label: "Habits", chipClass: "absolute left-3 top-3 rounded-chip bg-card px-2 py-1 font-ui text-caption text-habits", captionClass: "mt-4 font-ui text-caption text-habits", gradient: "linear-gradient(135deg, var(--dom-habits), var(--bg-card))" },
  skills: { label: "Skills", chipClass: "absolute left-3 top-3 rounded-chip bg-card px-2 py-1 font-ui text-caption text-skills", captionClass: "mt-4 font-ui text-caption text-skills", gradient: "linear-gradient(135deg, var(--dom-skills), var(--bg-card))" },
};

export function JourneyRail({ view }: { view: JourneyView }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const evidence = useMemo(() => view.days.flatMap((day) => day.evidence), [view.days]);
  const hasEvidence = evidence.length > 0;
  const today = useMemo(() => currentLocalDate(), []);
  const openIndex = evidence.findIndex((item) => item.id === openId);
  const selected = openIndex >= 0 ? evidence[openIndex] : null;

  return (
    <div className="mx-auto max-w-[45rem] px-4 pb-8">
      {!hasEvidence && <FirstProofPrompt />}
      {view.days.length > 0 && <div className="relative border-l-2 border-line pl-6">
        {view.days.map((day, index) => {
          const previous = view.days[index - 1];
          const showMonth = !previous || previous.month !== day.month;
          const isExpanded = expanded === day.localDate;
          const collapsed = day.evidence.length > 1 && !isExpanded;
          const shownEvidence = collapsed ? [] : day.evidence;
          return <section key={day.localDate} className="relative pb-8 last:pb-0">
            <span className="absolute -left-[1.875rem] top-2 h-3 w-3 rounded-chip border-2 border-canvas bg-ink-3" aria-hidden />
            {showMonth && <p className="sticky top-0 z-10 -ml-6 mb-3 bg-canvas py-2 font-ui text-caption uppercase tracking-wide text-ink-3">{monthLabel(day.month)}</p>}
            <p className="font-ui text-body tabular-nums text-ink-1">{dayLabel(day.localDate, today)}</p>
            {day.milestones.map((milestone) => <Milestone key={milestone.id} label={milestone.label} />)}
            {day.evidence.length > 1 && <button type="button" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : day.localDate)} className="mt-3 min-h-11 font-ui text-caption text-ink-2 underline decoration-line underline-offset-4">{isExpanded ? "Collapse proofs" : `${dayLabel(day.localDate, today)} · ${day.evidence.length} photos`}</button>}
            {shownEvidence.map((item) => <EvidenceCard key={item.id} item={item} note={day.note} onOpen={() => setOpenId(item.id)} />)}
          </section>;
        })}
      </div>}
      {selected && <Viewer item={selected} index={openIndex} total={evidence.length} onClose={() => setOpenId(null)} onPrevious={() => setOpenId(evidence[(openIndex - 1 + evidence.length) % evidence.length]?.id ?? null)} onNext={() => setOpenId(evidence[(openIndex + 1) % evidence.length]?.id ?? null)} />}
    </div>
  );
}

function FirstProofPrompt() {
  return <section className="relative border-l-2 border-line py-2 pl-6"><span className="absolute h-3 w-3 -translate-x-[1.875rem] rounded-chip border-2 border-canvas bg-ink-3" aria-hidden /><p className="font-display text-title text-ink-1">Your first proof belongs here.</p><p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">Snap a meal, a receipt, or the gym mirror when you are ready.</p><Link href="/today?capture=1" className="mt-4 inline-flex min-h-11 items-center font-ui text-caption text-ink-1 underline decoration-line underline-offset-4">Open capture</Link></section>;
}

function Milestone({ label }: { label: string }) {
  return <div className="relative mt-4 overflow-hidden rounded-card border border-line"><span className="absolute -left-[0.78rem] top-4 z-10 h-3 w-3 rotate-45 bg-energy" aria-hidden /><ArtFrame artKey={milestoneArt(label)} ratio="min-h-28 rounded-none border-0"><p className="flex h-full items-end p-4 font-display text-body text-ink-1">{label}</p></ArtFrame></div>;
}

function EvidenceCard({ item, note, onOpen }: { item: JourneyEvidence; note: string | null; onOpen: () => void }) {
  const domain = domains[item.domain];
  return <article className="mt-4 overflow-hidden rounded-card border border-line bg-card shadow-[var(--elev-card)]">
    <button type="button" onClick={onOpen} className="relative block h-44 w-full overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label={`View proof: ${item.caption}`}>
      <span aria-hidden className="absolute inset-0 opacity-70" style={{ background: domain.gradient }} />
      <span aria-hidden className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--line) 0, var(--line) 1px, transparent 1px, transparent var(--space-2))" }} />
      <span className={domain.chipClass}>{domain.label}</span>
      {item.missingImage && <span className="absolute bottom-3 left-3 font-ui text-caption text-ink-1">Image unavailable · {item.caption}</span>}
    </button>
    <div className="p-4"><p className="font-ui text-body text-ink-1">{item.caption}</p>{note && <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">“{note}”</p>}<Link href={`/today?domain=${item.domain}`} className="mt-4 inline-flex min-h-11 items-center font-ui text-caption text-ink-2 underline decoration-line underline-offset-4">View entry</Link></div>
  </article>;
}

function Viewer({ item, index, total, onClose, onPrevious, onNext }: { item: JourneyEvidence; index: number; total: number; onClose: () => void; onPrevious: () => void; onNext: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const domain = domains[item.domain];
  useEffect(() => {
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrevious();
      if (event.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onNext, onPrevious, item.id]);
  return <div role="dialog" aria-modal="true" aria-label="Evidence viewer" className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--scrim)] p-4"><div className="w-full max-w-lg rounded-card bg-card p-5 shadow-[var(--elev-card)]"><button ref={closeRef} type="button" className="float-right inline-flex min-h-11 min-w-11 items-center justify-center text-ink-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClose} aria-label="Close evidence viewer"><X size={18} strokeWidth={1.5} /></button><div className="mt-6 h-64 rounded-input" role="img" aria-label={item.missingImage ? `Image unavailable: ${item.caption}` : item.caption} style={{ background: domain.gradient }} /><p className={domain.captionClass}>{domain.label} · proof {index + 1} of {total}</p><p className="mt-2 font-coach text-title text-ink-1">{item.caption}</p><p className="mt-2 font-ui text-caption text-ink-2">{item.missingImage ? "Image unavailable — the typed proof remains." : item.entryKind}</p><div className="mt-5 flex items-center justify-between gap-2"><button type="button" onClick={onPrevious} className="inline-flex min-h-11 items-center gap-1 font-ui text-caption text-ink-2"><ChevronLeft size={16} strokeWidth={1.5} />Previous</button><Link href={`/today?domain=${item.domain}`} className="inline-flex min-h-11 items-center font-ui text-caption text-ink-1 underline decoration-line underline-offset-4">View entry</Link><button type="button" onClick={onNext} className="inline-flex min-h-11 items-center gap-1 font-ui text-caption text-ink-2">Next<ChevronRight size={16} strokeWidth={1.5} /></button></div></div></div>;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function currentLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dayLabel(localDate: string, today: string) {
  return localDate === today ? "Today" : localDate;
}
