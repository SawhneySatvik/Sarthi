"use client";

import { ImagePlus, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { byokHeaders } from "@/components/settings/byok";
import { pickTodayReflection } from "./pickTodayReflection";
import type { DailyReflectionRecord, ReflectionMediaRecord } from "@/data/schema/contract";

// D-053: a client component, so the browser's own zone is the right authority for "what
// day is it for me right now" — `en-CA` renders the device-local calendar day as YYYY-MM-DD
// (a UTC slice would show tomorrow/yesterday for a slice of each day).
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** A bounded, explicit day memory. It owns no capture/domain mutations. */
export function ReflectionMemory({ reflections, media }: { reflections: readonly DailyReflectionRecord[]; media: readonly ReflectionMediaRecord[] }) {
  const router = useRouter();
  const currentDate = today();
  // DATA-LOSS must-fix: only TODAY's own record may pre-fill. Never fall back to a past
  // reflection — Save upserts by localDate, so pre-filling a past day would overwrite it.
  const current = pickTodayReflection(reflections, currentDate);
  const [mood, setMood] = useState(current?.mood ?? "steady");
  const [energy, setEnergy] = useState(current?.energyLevel ?? 3);
  const [sleep, setSleep] = useState(current?.sleepMinutes?.toString() ?? "");
  const [journal, setJournal] = useState(current?.journal ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const currentMedia = useMemo(() => current ? media.filter((item) => item.reflectionId === current.id) : [], [current, media]);

  async function save() {
    setState("saving");
    const form = new FormData();
    // Always today: the editor never targets a past localDate, so Save can only create/update today.
    form.set("localDate", currentDate);
    form.set("mood", mood); form.set("energyLevel", String(energy)); form.set("sleepMinutes", sleep); form.set("journal", journal);
    for (const file of files) form.append("images", file);
    try {
      const response = await fetch("/api/journey/reflection", { method: "POST", body: form, headers: byokHeaders() });
      if (!response.ok) throw new Error();
      setFiles([]);
      setState("idle");
      router.refresh();
    } catch { setState("error"); }
  }

  return <section className="mb-8 rounded-card border border-line bg-card p-4 shadow-[var(--elev-card)]">
    <div>
      <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Daily reflection</p>
      <h2 className="mt-1 font-display text-title text-ink-1">Remember this day</h2>
      {current?.summary
        ? <figure className="mt-1"><blockquote className="font-coach text-body leading-[var(--leading-coach)] text-ink-1">{current.summary}</blockquote><figcaption className="mt-1 flex items-center gap-1 font-ui text-caption text-ink-3"><Sparkles size={13} strokeWidth={1.5} aria-hidden />Sarthi&apos;s reflection, not your words</figcaption></figure>
        : <p className="mt-1 font-coach text-body leading-[var(--leading-coach)] text-ink-2">Save a few facts from today. The memory stays yours.</p>}
      <div className="mt-4 grid grid-cols-5 gap-2" role="group" aria-label="Mood">{(["rough", "low", "steady", "good", "great"] as const).map((item) => <button key={item} type="button" onClick={() => setMood(item)} aria-pressed={mood === item} className={`min-h-11 rounded-chip border font-ui text-caption capitalize ${mood === item ? "border-ink-1 bg-raised text-ink-1" : "border-line text-ink-2"}`}>{item}</button>)}</div>
      <div className="mt-3 grid grid-cols-2 gap-3"><label className="font-ui text-caption text-ink-2">Energy (1–5)<input value={energy} onChange={(event) => setEnergy(Math.max(1, Math.min(5, Number(event.target.value) || 1)))} inputMode="numeric" className="mt-1 min-h-11 w-full rounded-input border border-line bg-canvas px-3 font-ui text-body text-ink-1" /></label><label className="font-ui text-caption text-ink-2">Sleep minutes<input value={sleep} onChange={(event) => setSleep(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 min-h-11 w-full rounded-input border border-line bg-canvas px-3 font-ui text-body text-ink-1" /></label></div>
      <label className="mt-3 block font-ui text-caption text-ink-2">Your note<textarea value={journal} onChange={(event) => setJournal(event.target.value)} maxLength={4000} className="mt-1 min-h-24 w-full rounded-input border border-line bg-canvas p-3 font-ui text-body text-ink-1" placeholder="What felt true today?" /></label>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 font-ui text-caption text-ink-2"><ImagePlus size={17} strokeWidth={1.5} aria-hidden />Add up to four images<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, Math.max(0, 4 - currentMedia.length)))} /></label>
      <Button className={`mt-4 min-h-12 w-full ${state === "saving" ? "animate-shimmer" : ""}`} disabled={state === "saving"} onClick={() => void save()}>{state === "saving" ? "Saving…" : <><Save size={17} strokeWidth={1.5} />Save reflection</>}</Button>
      {state === "error" && <p role="status" className="mt-2 font-ui text-caption text-danger">Could not save this reflection. Nothing else changed.</p>}
    </div>
  </section>;
}
