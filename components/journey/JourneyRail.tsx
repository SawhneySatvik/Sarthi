"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArtFrame } from "@/components/art/ArtFrame";
import { milestoneArt, selectJourneyArt } from "@/components/art/registry";
import type { DailyReflectionRecord, ReflectionMediaRecord } from "@/data/schema/contract";
import type { JourneyDay, JourneyView } from "@/core/game";

import { ReflectionMemory } from "./ReflectionMemory";

type MergedDay = { localDate: string; source: JourneyDay | null; reflection: DailyReflectionRecord | null; media: readonly ReflectionMediaRecord[] };

function labelDate(localDate: string): string {
  const date = new Date(`${localDate}T12:00:00`);
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", month: "short", day: "numeric" }).format(date);
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

export function JourneyRail({ view, reflections = [], media = [] }: { view: JourneyView; reflections?: readonly DailyReflectionRecord[]; media?: readonly ReflectionMediaRecord[] }) {
  const days = useMemo(() => mergeDays(view, reflections, media), [view, reflections, media]);
  const gallery = useMemo(() => days.flatMap((day) => day.media), [days]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return <div className="mx-auto max-w-[45rem] px-4 pb-8">
    {days.length === 0 ? <FirstProof /> : <div className="relative border-l-2 border-line pl-6">{days.map((day) => <DayCard key={day.localDate} day={day} onOpenMedia={(item) => setOpenIndex(gallery.findIndex((mediaItem) => mediaItem.id === item.id))} />)}</div>}
    <ReflectionMemory reflections={reflections} media={media} />
    {openIndex !== null && gallery[openIndex] && <GalleryViewer items={gallery} index={openIndex} onClose={() => setOpenIndex(null)} onIndex={setOpenIndex} />}
  </div>;
}

function FirstProof() { return <section className="rounded-card border border-line bg-card p-5"><p className="font-display text-title text-ink-1">Your first day is waiting.</p><p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">Save a reflection or capture a real moment when you are ready.</p></section>; }

function DayCard({ day, onOpenMedia }: { day: MergedDay; onOpenMedia: (item: ReflectionMediaRecord) => void }) {
  const facts = day.source?.evidence.length ?? 0;
  const evidence = day.source?.evidence[0] ?? null;
  const artKey = evidence ? selectJourneyArt(evidence.domain, evidence.entryKind, evidence.caption) : day.source?.milestones[0] ? milestoneArt(day.source.milestones[0].label) : "coach.week_band";
  const taskProgress = day.source?.taskProgress ?? null;
  return <section className="relative pb-7"><span aria-hidden className="absolute -left-[1.86rem] top-5 h-3 w-3 rounded-chip border-2 border-canvas bg-ink-3" /><article className="overflow-hidden rounded-card border border-line bg-card shadow-[var(--elev-card)]"><ArtFrame artKey={artKey} ratio="h-24" className="rounded-none border-0"><div className="flex h-full items-end p-4"><p className="font-display text-title text-ink-1">{labelDate(day.localDate)}</p></div></ArtFrame><div className="grid grid-cols-2 gap-px bg-line"><Tile label="Wellness" value={day.reflection ? `${day.reflection.mood} · energy ${day.reflection.energyLevel}/5${day.reflection.sleepMinutes === null ? "" : ` · sleep ${day.reflection.sleepMinutes}m`}` : "No check-in saved"} /><Tile label="Task progress" value={taskProgress ? `${taskProgress.done} / ${taskProgress.total} done` : "No plan item saved"} /><MemoriesTile media={day.media} evidenceCount={facts} onOpen={onOpenMedia} /><Tile label="Journal + reflection" value={day.reflection?.summary ?? day.source?.note ?? "No reflection saved"} /></div></article></section>;
}

function Tile({ label, value }: { label: string; value: string }) { return <div className="min-h-28 bg-card p-3"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">{label}</p><p className="mt-2 line-clamp-3 font-ui text-caption text-ink-1">{value}</p></div>; }

function MemoriesTile({ media, evidenceCount, onOpen }: { media: readonly ReflectionMediaRecord[]; evidenceCount: number; onOpen: (item: ReflectionMediaRecord) => void }) {
  if (media.length === 0) return <Tile label="Memories" value={evidenceCount ? `${evidenceCount} typed moments, no image saved` : "No image saved"} />;
  return <button type="button" onClick={() => onOpen(media[0])} className="relative min-h-28 overflow-hidden bg-card text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px">{media.slice(0, 4).map((item) => <span key={item.id} className="relative overflow-hidden"><Image src={`/api/journey/media/${item.id}`} alt="" fill sizes="(max-width: 45rem) 50vw, 16rem" unoptimized className="object-cover" /></span>)}</span><span className="absolute inset-0 bg-[var(--scrim)] opacity-30" /><span className="relative z-10 block p-3 font-ui text-caption uppercase tracking-wide text-ink-1">Memories · {media.length}</span></button>;
}

function GalleryViewer({ items, index, onClose, onIndex }: { items: readonly ReflectionMediaRecord[]; index: number; onClose: () => void; onIndex: (value: number) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = items[index];
  useEffect(() => { closeRef.current?.focus(); const keys = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length); if (event.key === "ArrowRight") onIndex((index + 1) % items.length); }; window.addEventListener("keydown", keys); return () => window.removeEventListener("keydown", keys); }, [index, items.length, onClose, onIndex]);
  return <div role="dialog" aria-modal="true" aria-label="Reflection gallery" className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim)] p-4"><motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15} onDragEnd={(_, info) => { if (info.offset.x > 64) onIndex((index - 1 + items.length) % items.length); if (info.offset.x < -64) onIndex((index + 1) % items.length); }} className="relative w-full max-w-xl overflow-hidden rounded-card bg-card shadow-[var(--elev-card)]"><Image src={`/api/journey/media/${item.id}`} alt={item.caption ?? "Reflection memory"} width={960} height={960} unoptimized className="max-h-[70dvh] w-full object-contain" /><div className="flex items-center justify-between p-3"><button type="button" onClick={() => onIndex((index - 1 + items.length) % items.length)} className="flex min-h-11 min-w-11 items-center justify-center text-ink-2" aria-label="Previous image"><ChevronLeft size={20} strokeWidth={1.5} /></button><p className="font-ui text-caption text-ink-2">{index + 1} of {items.length}</p><button type="button" onClick={() => onIndex((index + 1) % items.length)} className="flex min-h-11 min-w-11 items-center justify-center text-ink-2" aria-label="Next image"><ChevronRight size={20} strokeWidth={1.5} /></button></div><button ref={closeRef} type="button" onClick={onClose} className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-chip bg-raised text-ink-1" aria-label="Close reflection gallery"><X size={18} strokeWidth={1.5} /></button></motion.div></div>;
}
