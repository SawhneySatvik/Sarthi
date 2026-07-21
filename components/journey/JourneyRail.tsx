"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArtFrame } from "@/components/art/ArtFrame";
import { Reveal } from "@/components/ui/Reveal";
import { milestoneArt, selectJourneyArt } from "@/components/art/registry";
import { relativeDay } from "@/app/lib/relativeDay";
import type { DailyReflectionRecord, ReflectionMediaRecord } from "@/data/schema/contract";
import type { JourneyDay, JourneyView } from "@/core/game";

import { ReflectionMemory } from "./ReflectionMemory";

const EXPAND_SEC = 0.2;

type MergedDay = { localDate: string; source: JourneyDay | null; reflection: DailyReflectionRecord | null; media: readonly ReflectionMediaRecord[] };

// Device-local calendar day — matches ReflectionMemory.today()/relativeDay's authority for "today".
function deviceToday(): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function mergeDays(view: JourneyView, reflections: readonly DailyReflectionRecord[], media: readonly ReflectionMediaRecord[]): readonly MergedDay[] {
  const map = new Map<string, MergedDay>();
  for (const source of view.days) map.set(source.localDate, { localDate: source.localDate, source, reflection: null, media: [] });
  for (const reflection of reflections) {
    const existing = map.get(reflection.localDate);
    map.set(reflection.localDate, { localDate: reflection.localDate, source: existing?.source ?? null, reflection, media: media.filter((item) => item.reflectionId === reflection.id) });
  }
  return [...map.values()].sort((a, b) => b.localDate.localeCompare(a.localDate));
}

/** The one-line preview shown on a collapsed day. `fromCoach` marks AI-authored text so it can be attributed. */
function collapsedLine(day: MergedDay): { text: string; fromCoach: boolean } {
  if (day.reflection?.summary) return { text: day.reflection.summary, fromCoach: true };
  const facts = day.source?.evidence.length ?? 0;
  if (facts > 0) return { text: `${facts} typed moment${facts === 1 ? "" : "s"}`, fromCoach: false };
  const progress = day.source?.taskProgress;
  if (progress) return { text: `${progress.done} / ${progress.total} tasks done`, fromCoach: false };
  return { text: "A quiet day", fromCoach: false };
}

export function JourneyRail({ view, reflections = [], media = [] }: { view: JourneyView; reflections?: readonly DailyReflectionRecord[]; media?: readonly ReflectionMediaRecord[] }) {
  const days = useMemo(() => mergeDays(view, reflections, media), [view, reflections, media]);
  const gallery = useMemo(() => days.flatMap((day) => day.media), [days]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Accordion (mirrors the gallery openIndex pattern as a single nullable): today opens by default,
  // else the most-recent day; a second tap collapses. null = every day collapsed.
  const initialOpen = useMemo(() => {
    const today = deviceToday();
    return days.find((day) => day.localDate === today)?.localDate ?? days[0]?.localDate ?? null;
  }, [days]);
  const [openDate, setOpenDate] = useState<string | null>(initialOpen);
  const [interacted, setInteracted] = useState(false);
  const reduce = useReducedMotion();
  const todayStr = deviceToday();

  const toggle = (localDate: string) => { setInteracted(true); setOpenDate((prev) => (prev === localDate ? null : localDate)); };
  const openMedia = (item: ReflectionMediaRecord) => setOpenIndex(gallery.findIndex((mediaItem) => mediaItem.id === item.id));

  return <div className="mx-auto max-w-[45rem] px-4 pb-8 lg:max-w-[64rem]">
    {days.length === 0
      ? <FirstProof />
      : <div className="relative border-l-2 border-line pl-6 lg:grid lg:grid-cols-2 lg:gap-5 lg:border-l-0 lg:pl-0">
          {days.map((day, i) => <DayCard key={day.localDate} day={day} index={i} open={day.localDate === openDate} isToday={day.localDate === todayStr} animate={interacted && !reduce} onToggle={() => toggle(day.localDate)} onOpenMedia={openMedia} />)}
        </div>}
    <ReflectionMemory reflections={reflections} media={media} />
    {openIndex !== null && gallery[openIndex] && <GalleryViewer items={gallery} index={openIndex} onClose={() => setOpenIndex(null)} onIndex={setOpenIndex} />}
  </div>;
}

function FirstProof() { return <section className="overflow-hidden rounded-card border border-line bg-card shadow-[var(--elev-card)]"><ArtFrame artKey="empty.stillness" className="min-h-56 rounded-none border-0"><div className="flex h-full flex-col justify-end p-5"><p className="font-display text-title on-art">Your first day is waiting.</p><p className="mt-2 font-coach text-body leading-[var(--leading-coach)] on-art-dim">Save a reflection or capture a real moment when you are ready.</p></div></ArtFrame></section>; }

function DayCard({ day, index, open, isToday, animate, onToggle, onOpenMedia }: { day: MergedDay; index: number; open: boolean; isToday: boolean; animate: boolean; onToggle: () => void; onOpenMedia: (item: ReflectionMediaRecord) => void }) {
  const facts = day.source?.evidence.length ?? 0;
  const evidence = day.source?.evidence[0] ?? null;
  const milestones = day.source?.milestones ?? [];
  const artKey = evidence ? selectJourneyArt(evidence.domain, evidence.entryKind, evidence.caption) : milestones[0] ? milestoneArt(milestones[0].label) : "coach.week_band";
  const preview = collapsedLine(day);
  const panelId = `journey-panel-${day.localDate}`;

  // Calm staggered entrance on the timeline (Reveal carries the grid col-span className and
  // collapses to a static <section> under reduced motion). `once` + the stable localDate key
  // mean an accordion toggle re-render never replays it; the accordion panel below keeps its
  // own first-paint suppression (`animate`) untouched.
  return <Reveal as="section" delay={Math.min(index, 8) * 0.04} className={`relative pb-7 lg:pb-0 ${open ? "lg:col-span-2" : ""}`}>
    {/* Mobile spine node; hidden on the desktop multi-column grid. Milestone days earn an amber diamond. */}
    <span aria-hidden className={`absolute -left-[1.86rem] top-5 lg:hidden ${milestones.length ? "h-3 w-3 rotate-45 rounded-none bg-energy" : "h-3 w-3 rounded-chip bg-ink-3"} border-2 border-canvas`} />
    <article className="overflow-hidden rounded-card border border-line bg-card shadow-[var(--elev-card)]">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <ArtFrame artKey={artKey} ratio={open ? "h-28 lg:h-36" : "h-24"} className="rounded-none border-0">
          <div className="flex h-full items-end justify-between p-4">
            <p className="font-display text-title on-art">{relativeDay(day.localDate)}</p>
            <ChevronDown size={20} strokeWidth={1.5} aria-hidden className={`on-art transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
          </div>
        </ArtFrame>
        {!open && <div className="flex items-center gap-2 px-4 py-3">
          {milestones.length > 0 && <span aria-hidden className="h-2 w-2 shrink-0 rotate-45 rounded-none bg-energy" />}
          <p className="line-clamp-1 font-ui text-caption text-ink-2">{preview.text}{preview.fromCoach && <span className="text-ink-3"> — Sarthi</span>}</p>
        </div>}
      </button>
      {open && <motion.div id={panelId} initial={animate ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: animate ? EXPAND_SEC : 0 }}>
        {milestones.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          {milestones.map((milestone) => <span key={milestone.id} className="inline-flex items-center gap-1.5 font-ui text-caption text-ink-1"><span aria-hidden className="h-2 w-2 rotate-45 rounded-none bg-energy" />{milestone.label}</span>)}
        </div>}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line lg:grid-cols-4">
          <Tile label="Wellness" value={day.reflection ? `${day.reflection.mood} · energy ${day.reflection.energyLevel}/5${day.reflection.sleepMinutes === null ? "" : ` · sleep ${day.reflection.sleepMinutes}m`}` : "No check-in saved"} />
          <Tile label="Task progress" value={day.source?.taskProgress ? `${day.source.taskProgress.done} / ${day.source.taskProgress.total} done` : "No plan item saved"} />
          <MemoriesTile media={day.media} evidenceCount={facts} onOpen={onOpenMedia} />
          <Tile label="Your words" value={day.reflection?.journal.trim() ? day.reflection.journal : "No note saved"} />
        </div>
        {/* AI reflection is attributed and kept clearly separate from the user's own words above.
            Today's summary is owned by the editor below (ReflectionMemory), so skip it here to avoid the echo. */}
        {!isToday && day.reflection?.summary && <div className="border-t border-line px-4 py-3">
          <p className="flex items-center gap-1 font-ui text-caption uppercase tracking-wide text-ink-3"><Sparkles size={13} strokeWidth={1.5} aria-hidden />Sarthi&apos;s reflection</p>
          <p className="mt-1 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{day.reflection.summary}</p>
        </div>}
      </motion.div>}
    </article>
  </Reveal>;
}

function Tile({ label, value }: { label: string; value: string }) { return <div className="min-h-28 bg-card p-3"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">{label}</p><p className="mt-2 line-clamp-3 font-ui text-caption text-ink-1">{value}</p></div>; }

function MemoriesTile({ media, evidenceCount, onOpen }: { media: readonly ReflectionMediaRecord[]; evidenceCount: number; onOpen: (item: ReflectionMediaRecord) => void }) {
  if (media.length === 0) return <Tile label="Memories" value={evidenceCount ? `${evidenceCount} typed moment${evidenceCount === 1 ? "" : "s"}, no image saved` : "No image saved"} />;
  return <button type="button" onClick={() => onOpen(media[0])} className="relative min-h-28 overflow-hidden bg-card text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px">{media.slice(0, 4).map((item) => <span key={item.id} className="relative overflow-hidden"><Image src={`/api/journey/media/${item.id}`} alt="" fill sizes="(max-width: 45rem) 50vw, 16rem" unoptimized className="object-cover" /></span>)}</span><span className="absolute inset-0 bg-[var(--scrim)] opacity-30" /><span className="relative z-10 block p-3 font-ui text-caption uppercase tracking-wide text-ink-1">Memories · {media.length}</span></button>;
}

function GalleryViewer({ items, index, onClose, onIndex }: { items: readonly ReflectionMediaRecord[]; index: number; onClose: () => void; onIndex: (value: number) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = items[index];
  useEffect(() => { closeRef.current?.focus(); const keys = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length); if (event.key === "ArrowRight") onIndex((index + 1) % items.length); }; window.addEventListener("keydown", keys); return () => window.removeEventListener("keydown", keys); }, [index, items.length, onClose, onIndex]);
  return <div role="dialog" aria-modal="true" aria-label="Reflection gallery" className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim)] p-4"><motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15} onDragEnd={(_, info) => { if (info.offset.x > 64) onIndex((index - 1 + items.length) % items.length); if (info.offset.x < -64) onIndex((index + 1) % items.length); }} className="relative w-full max-w-xl overflow-hidden rounded-card bg-card shadow-[var(--elev-card)]"><Image src={`/api/journey/media/${item.id}`} alt={item.caption ?? "Reflection memory"} width={960} height={960} unoptimized className="max-h-[70dvh] w-full object-contain" /><div className="flex items-center justify-between p-3"><button type="button" onClick={() => onIndex((index - 1 + items.length) % items.length)} className="flex min-h-11 min-w-11 items-center justify-center text-ink-2" aria-label="Previous image"><ChevronLeft size={20} strokeWidth={1.5} /></button><p className="font-ui text-caption text-ink-2">{index + 1} of {items.length}</p><button type="button" onClick={() => onIndex((index + 1) % items.length)} className="flex min-h-11 min-w-11 items-center justify-center text-ink-2" aria-label="Next image"><ChevronRight size={20} strokeWidth={1.5} /></button></div><button ref={closeRef} type="button" onClick={onClose} className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-chip bg-raised text-ink-1" aria-label="Close reflection gallery"><X size={18} strokeWidth={1.5} /></button></motion.div></div>;
}
