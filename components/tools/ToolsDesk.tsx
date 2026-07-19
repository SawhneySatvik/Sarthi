"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Lightbulb, Play, Plus, Send, TimerReset, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { runtimeProviderHeaders } from "@/components/settings/runtimeOverride";

import { type ActiveToolRun, isToolRunReady, useClockNow, useToolsRun } from "./ToolsProvider";
import type { ToolsView } from "@/core/tools";

export interface ToolSkill { id: string; name: string; masteryMinutes: number; targetMinutes: number | null; }
export interface ToolsDeskProps { view: ToolsView; resumeRun: boolean; screenshotMeditationConsent: boolean; }

type Sheet = "focus" | "meditation" | "suggest" | null;
type FocusPhase = "setup" | "running" | "ready" | "abandon" | "complete" | "error";
type MeditationPhase = "idle" | "consent" | "running" | "ready" | "complete" | "error";

const FOCUS_MINUTES = [25, 50, 90] as const;
const PATTERNS = [
  { id: "box", label: "Box 4-4-4-4", minutes: 5 },
  { id: "478", label: "4-7-8", minutes: 5 },
  { id: "calm", label: "Calm 5m", minutes: 5 },
  { id: "ten", label: "10m", minutes: 10 },
] as const;

function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  const seed = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(32, "0").slice(0, 32);
  return `${seed.slice(0, 8)}-${seed.slice(8, 12)}-4${seed.slice(13, 16)}-8${seed.slice(17, 20)}-${seed.slice(20)}`;
}

function breathPhase(startedAt: number, now: number, patternId: string): { label: string; scale: number; opacity: number } {
  const second = Math.floor((now - startedAt) / 1000);
  const phases = patternId === "478"
    ? [{ label: "in…", seconds: 4, scale: 1.12, opacity: 1 }, { label: "hold…", seconds: 7, scale: 1.12, opacity: 0.9 }, { label: "out…", seconds: 8, scale: 0.84, opacity: 0.72 }]
    : [{ label: "in…", seconds: 4, scale: 1.12, opacity: 1 }, { label: "hold…", seconds: 4, scale: 1.12, opacity: 0.9 }, { label: "out…", seconds: 4, scale: 0.84, opacity: 0.72 }, { label: "hold…", seconds: 4, scale: 0.84, opacity: 0.78 }];
  const period = phases.reduce((total, item) => total + item.seconds, 0);
  let progress = second % period;
  for (const item of phases) { if (progress < item.seconds) return item; progress -= item.seconds; }
  return phases[0];
}

async function postTool<T extends Record<string, unknown> = Record<string, never>>(path: string, body: Record<string, unknown>, useRuntimeProvider = false): Promise<{ ok: boolean } & T> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(useRuntimeProvider ? runtimeProviderHeaders() : {}) }, body: JSON.stringify(body) });
    if (!response.ok) return { ok: false } as { ok: boolean } & T;
    const payload = (await response.json()) as { ok?: boolean } & T;
    return { ...payload, ok: payload.ok === true };
  } catch {
    return { ok: false } as { ok: boolean } & T;
  }
}

function ToolSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-50 flex flex-col bg-canvas"><div className="mx-auto mt-3 h-1 w-10 rounded-chip bg-line" /><header className="flex items-center justify-between px-4 py-4"><button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center text-ink-2" aria-label="Close tool"><ChevronLeft size={22} strokeWidth={1.5} /></button><h2 className="font-display text-title text-ink-1">{title}</h2><button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-end text-ink-2" aria-label="Close tool"><X size={20} strokeWidth={1.5} /></button></header><div className="flex-1 overflow-y-auto px-4 pb-12">{children}</div></motion.div>;
}

export function ToolsDesk({ view, resumeRun, screenshotMeditationConsent }: ToolsDeskProps) {
  const { run } = useToolsRun();
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [suggested, setSuggested] = useState(false);
  const activeSheet = screenshotMeditationConsent ? "meditation" : resumeRun && run ? run.kind : sheet;
  function closeSheet() { setSheet(null); if (resumeRun) router.replace("/tools", { scroll: false }); }
  const liveLabel = run?.kind === "focus" ? "In focus" : run?.kind === "meditation" ? "Breathing now" : null;
  return <><section className="px-4 pb-10"><p className="pt-1 font-ui text-body text-ink-2">Tap a tool to start</p><div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3"><ToolCard name="Focus" description={liveLabel ?? "Make room for deep practice"} kind="focus" tall onClick={() => setSheet("focus")} /><ToolCard name="Meditation" description={run?.kind === "meditation" ? "Breathing now" : "A quiet reset"} kind="meditation" onClick={() => setSheet("meditation")} /><ToolCard name="Afford it?" description="A calm money check" kind="money" soon onClick={() => setToast("On the way.")} /><ToolCard name="Workout counter" description="One-thumb gym logging" kind="health" soon onClick={() => setToast("On the way.")} /><button type="button" onClick={() => setSheet("suggest")} className="flex min-h-40 flex-col justify-between rounded-card border border-dashed border-line bg-card p-4 text-left shadow-[var(--elev-card)]"><Lightbulb className="text-ink-2" size={23} strokeWidth={1.5} aria-hidden /><span><span className="block font-display text-title text-ink-1">{suggested ? "Noted — thank you." : "Would you like a new tool?"}</span><span className="mt-1 block font-ui text-caption text-ink-2">{suggested ? "For this session." : "Tell us what would help."}</span></span></button></div></section><AnimatePresence>{activeSheet === "focus" && <FocusSheet skills={view.focus.skills} defaultSkillId={view.focus.defaultSkillId} initialRun={run?.kind === "focus" ? run : null} onClose={closeSheet} />}{activeSheet === "meditation" && <MeditationSheet hasMeditateHabit={screenshotMeditationConsent ? false : view.meditation.hasMeditateHabit} initialRun={run?.kind === "meditation" ? run : null} onClose={closeSheet} />}{activeSheet === "suggest" && <SuggestSheet onDone={() => { setSuggested(true); closeSheet(); }} onClose={closeSheet} />}</AnimatePresence>{toast && <div role="status" className="fixed inset-x-4 bottom-32 z-50 mx-auto max-w-sm rounded-card border border-line bg-raised px-4 py-3 text-center font-ui text-body text-ink-1 shadow-[var(--elev-card)]">{toast}</div>}</>;
}

function ToolCard({ name, description, kind, tall = false, soon = false, onClick }: { name: string; description: string; kind: "focus" | "meditation" | "money" | "health"; tall?: boolean; soon?: boolean; onClick: () => void }) {
  const tick = kind === "focus" ? "bg-skills" : kind === "meditation" ? "bg-habits" : kind === "money" ? "bg-money" : "bg-health";
  return <button type="button" onClick={onClick} className={`relative flex min-h-40 overflow-hidden rounded-card border border-line bg-card p-4 text-left shadow-[var(--elev-card)] transition-colors duration-[var(--t-base)] ${tall ? "row-span-2 min-h-[21rem]" : ""} ${soon ? "opacity-60" : ""}`}><span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${tick}`} /><span className="flex h-full flex-col justify-end"><span className="font-display text-title text-ink-1">{name}</span><span className="mt-1 font-ui text-caption text-ink-2">{description}</span>{soon && <span className="mt-3 font-ui text-caption text-ink-3">soon</span>}</span></button>;
}

function FocusSheet({ skills, defaultSkillId, initialRun, onClose }: { skills: readonly ToolSkill[]; defaultSkillId: string | null; initialRun: ActiveToolRun | null; onClose: () => void }) {
  const { run, startRun, clearRun } = useToolsRun();
  const router = useRouter();
  const now = useClockNow();
  const [phase, setPhase] = useState<FocusPhase>(initialRun ? "running" : "setup");
  const [minutes, setMinutes] = useState(initialRun?.durationMinutes ?? 25);
  const [custom, setCustom] = useState("");
  const [skillId, setSkillId] = useState(initialRun?.skillId ?? defaultSkillId ?? "");
  const [newSkill, setNewSkill] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCommitId, setLastCommitId] = useState<string | null>(null);
  const [pendingMinutes, setPendingMinutes] = useState<number | null>(null);
  const current = run?.kind === "focus" ? run : initialRun;
  const elapsed = current ? Math.floor((now - current.startedAt) / 60000) : 0;
  const measured = Math.min(minutes, elapsed);
  const selected = skills.find((skill) => skill.id === skillId);
  const target = selected?.targetMinutes ?? 30000;
  const heading = selected ? `${Math.floor(selected.masteryMinutes / 60)}:${String(selected.masteryMinutes % 60).padStart(2, "0")} → ${Math.floor(target / 60)}h` : "Choose a skill to begin";

  async function ensureSkill(): Promise<string | null> {
    if (!newSkill) return skillId || null;
    const name = skillName.trim(); if (!name) return null;
    const response = await postTool<{ skill?: { id?: string } }>("/api/tools/skills", { name });
    return response.ok ? response.skill?.id ?? null : null;
  }
  async function start() { const resolvedSkillId = await ensureSkill(); if (!resolvedSkillId) { setPhase("error"); return; } const next = { kind: "focus" as const, startedAt: Date.now(), durationMinutes: minutes, skillId: resolvedSkillId, skillName: selected?.name ?? skillName.trim(), idempotencyKey: newIdempotencyKey() }; startRun(next); setPhase("running"); }
  async function complete(loggedMinutes = minutes) { if (!current?.skillId) return; setPendingMinutes(loggedMinutes); setBusy(true); const result = await postTool<{ commitId?: string }>("/api/tools/focus/complete", { skillId: current.skillId, minutes: loggedMinutes, idempotencyKey: current.idempotencyKey }, true); setBusy(false); if (!result.ok || !result.commitId) { setPhase("error"); return; } clearRun(); setLastCommitId(result.commitId); router.refresh(); setPhase("complete"); }
  function note() { window.dispatchEvent(new CustomEvent("sarthi:capture-note", { detail: { text: `Focused on ${current?.skillName ?? "practice"} for ${minutes} minutes.` } })); onClose(); }
  const runReady = phase === "running" && current !== null && isToolRunReady(current, now);
  return <ToolSheet title="Focus" onClose={onClose}><div className="mx-auto max-w-md"><p className="font-coach text-title leading-[var(--leading-coach)] text-ink-1">{phase === "running" ? "Keep the room quiet." : "One measured block, filed to your practice."}</p>{phase === "setup" && <><div className="mt-8 flex flex-wrap gap-2">{FOCUS_MINUTES.map((value) => <Chip key={value} active={minutes === value} onClick={() => { setMinutes(value); setCustom(""); }}>{value} min</Chip>)}<Chip active={custom.length > 0} onClick={() => setCustom(custom || "25")}>Custom</Chip></div>{custom.length > 0 && <input inputMode="numeric" value={custom} onChange={(event) => { setCustom(event.target.value); const value = Number(event.target.value); if (Number.isInteger(value) && value > 0) setMinutes(value); }} className="mt-3 w-full rounded-input border border-line bg-card px-3 py-3 font-ui text-body text-ink-1 focus:outline-none" aria-label="Custom focus minutes" />}{newSkill ? <div className="mt-6"><label className="font-ui text-caption text-ink-2" htmlFor="new-skill">New skill</label><input id="new-skill" value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="e.g. System design" className="mt-2 w-full rounded-input border border-line bg-card px-3 py-3 font-ui text-body text-ink-1 placeholder:text-ink-3 focus:outline-none" /></div> : <div className="mt-6"><label className="font-ui text-caption text-ink-2" htmlFor="focus-skill">Practice</label><select id="focus-skill" value={skillId} onChange={(event) => setSkillId(event.target.value)} className="mt-2 w-full rounded-input border border-line bg-card px-3 py-3 font-ui text-body text-ink-1 focus:outline-none"><option value="">Choose a skill</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select><button type="button" onClick={() => setNewSkill(true)} className="mt-3 inline-flex min-h-11 items-center gap-2 font-ui text-caption text-skills-strong"><Plus size={15} strokeWidth={1.5} aria-hidden />New skill</button></div>}<p className="mt-8 font-ui text-caption tabular-nums text-ink-2">{heading}</p><Button className="mt-3 min-h-12 w-full" onClick={() => void start()}><Play size={17} strokeWidth={1.5} aria-hidden />Start {minutes} min</Button></>}{phase === "running" && !runReady && <><p className="mt-12 text-center font-display text-display-xl tabular-nums text-ink-1">{Math.max(0, minutes - elapsed)}:00</p><p className="mt-2 text-center font-ui text-caption text-ink-2">{current?.skillName}</p><Button className="mt-10 min-h-12 w-full" onClick={onClose}>Continue</Button><Button variant="ghost" className="mt-3 min-h-12 w-full" onClick={() => setPhase("abandon")}>End early</Button></>}{(phase === "ready" || runReady) && <><p className="mt-12 text-center font-coach text-title text-ink-1">Your block is ready to file.</p><p className="mt-2 text-center font-ui text-caption text-ink-2">{minutes} measured minutes · {current?.skillName}</p><Button className="mt-10 min-h-12 w-full" onClick={() => void complete(minutes)} disabled={busy}>{busy ? "Filing…" : `File ${minutes} min`}</Button><Button variant="ghost" className="mt-3 min-h-12 w-full" onClick={() => { clearRun(); onClose(); }}>Discard</Button></>}{phase === "abandon" && <><p className="mt-10 font-coach text-title text-ink-1">{measured > 0 ? "Log the time you did make?" : "No full minute has passed yet."}</p><p className="mt-2 font-ui text-body text-ink-2">{measured > 0 ? `${measured} measured minute${measured === 1 ? "" : "s"} can still count.` : "Keep going or discard this session — nothing has been filed."}</p>{measured > 0 && <Button className="mt-7 min-h-12 w-full" onClick={() => void complete(measured)} disabled={busy}>Log {measured} min</Button>}<Button variant="ghost" className="mt-3 min-h-12 w-full" onClick={() => { clearRun(); onClose(); }}>Discard</Button>{measured === 0 && <Button className="mt-3 min-h-12 w-full" onClick={() => setPhase("running")}>Continue</Button>}</>}{phase === "complete" && <CompletionStrip kind="focus" text="Focus session filed to Skills." commitId={lastCommitId} onNote={note} />}{phase === "error" && <><p className="mt-10 font-coach text-title text-danger">Couldn’t file this session.</p><p className="mt-2 font-ui text-body text-ink-2">Your run is still open. Check your connection and retry.</p><Button className="mt-7 min-h-12 w-full" onClick={() => void complete(pendingMinutes ?? minutes)} disabled={busy}><TimerReset size={17} strokeWidth={1.5} aria-hidden />Retry filing</Button></>}</div></ToolSheet>;
}

function MeditationSheet({ hasMeditateHabit, initialRun, onClose }: { hasMeditateHabit: boolean; initialRun: ActiveToolRun | null; onClose: () => void }) {
  const { run, startRun, clearRun } = useToolsRun(); const reduce = useReducedMotion();
  const router = useRouter();
  const now = useClockNow();
  const [phase, setPhase] = useState<MeditationPhase>(initialRun ? "running" : "idle"); const [patternId, setPatternId] = useState(initialRun?.patternId ?? "box"); const [tts, setTts] = useState(false); const [busy, setBusy] = useState(false); const [lastCommitId, setLastCommitId] = useState<string | null>(null);
  const pattern = PATTERNS.find((item) => item.id === patternId) ?? PATTERNS[0]; const current = run?.kind === "meditation" ? run : initialRun; const elapsed = current ? Math.floor((now - current.startedAt) / 60000) : 0;
  const phaseMotion = breathPhase(current?.startedAt ?? now, now, patternId);
  function begin() { if (!hasMeditateHabit) { setPhase("consent"); return; } startRun({ kind: "meditation", startedAt: Date.now(), durationMinutes: pattern.minutes, patternId, idempotencyKey: newIdempotencyKey() }); setPhase("running"); }
  function consent() { startRun({ kind: "meditation", startedAt: Date.now(), durationMinutes: pattern.minutes, patternId, idempotencyKey: newIdempotencyKey() }); setPhase("running"); }
  async function complete() { if (!current) return; setBusy(true); const result = await postTool<{ commitId?: string }>("/api/tools/meditation/complete", { minutes: current.durationMinutes, patternId: current.patternId, consented: true, idempotencyKey: current.idempotencyKey }, true); setBusy(false); if (!result.ok || !result.commitId) { setPhase("error"); return; } clearRun(); setLastCommitId(result.commitId); router.refresh(); setPhase("complete"); }
  const runReady = phase === "running" && current !== null && isToolRunReady(current, now);
  return <ToolSheet title="Meditation" onClose={onClose}><div className="mx-auto max-w-md">{phase === "idle" && <><p className="font-coach text-title leading-[var(--leading-coach)] text-ink-1">Let one breath lead the next.</p><div className="mt-7 flex flex-wrap gap-2">{PATTERNS.map((item) => <Chip key={item.id} active={patternId === item.id} onClick={() => setPatternId(item.id)}>{item.label}</Chip>)}</div><label className="mt-8 flex min-h-11 items-center justify-between border-y border-line py-3"><span><span className="block font-ui text-body text-ink-1">Voice guidance</span><span className="block font-ui text-caption text-ink-2">On this device only</span></span><input type="checkbox" checked={tts} onChange={(event) => setTts(event.target.checked)} className="h-5 w-5 accent-[var(--dom-habits)]" /></label><Button className="mt-8 min-h-12 w-full" onClick={begin}><Play size={17} strokeWidth={1.5} aria-hidden />Start {pattern.minutes} min</Button></>}{phase === "consent" && <><p className="mt-10 font-coach text-title text-ink-1">Add Meditate to your habits?</p><p className="mt-2 font-ui text-body text-ink-2">Finishing this first session will add one daily habit and log today’s practice. You can undo that batch.</p><Button className="mt-8 min-h-12 w-full" onClick={consent}>Add and start</Button><Button variant="ghost" className="mt-3 min-h-12 w-full" onClick={() => setPhase("idle")}>Not now</Button></>}{phase === "running" && !runReady && <><motion.div animate={reduce ? { opacity: phaseMotion.opacity } : { scale: phaseMotion.scale }} className="mx-auto mt-14 flex h-48 w-48 items-center justify-center rounded-chip bg-habits/20" aria-live="polite"><span className="font-coach text-title text-habits-strong">{phaseMotion.label}</span></motion.div><p className="mt-8 text-center font-ui text-caption tabular-nums text-ink-2">{Math.max(0, pattern.minutes - elapsed)}:00 · {pattern.label}</p><Button className="mt-10 min-h-12 w-full" onClick={onClose}>Continue</Button><Button variant="ghost" className="mt-3 min-h-12 w-full" onClick={() => { clearRun(); onClose(); }}>Discard session</Button></>}{(phase === "ready" || runReady) && <><p className="mt-12 text-center font-coach text-title text-ink-1">Your practice is ready to file.</p><p className="mt-2 text-center font-ui text-caption text-ink-2">{pattern.minutes} measured minutes · {pattern.label}</p><Button className="mt-10 min-h-12 w-full" onClick={() => void complete()} disabled={busy}>{busy ? "Filing…" : `File ${pattern.minutes} min`}</Button><Button variant="ghost" className="mt-3 min-h-12 w-full" onClick={() => { clearRun(); onClose(); }}>Discard</Button></>}{phase === "complete" && <CompletionStrip kind="meditation" text="Meditation filed to Habits." commitId={lastCommitId} />}{phase === "error" && <><p className="mt-10 font-coach text-title text-danger">Couldn’t file this practice.</p><p className="mt-2 font-ui text-body text-ink-2">Your session remains open. Retry when you’re ready.</p><Button className="mt-7 min-h-12 w-full" onClick={() => void complete()} disabled={busy}>Retry filing</Button></>}</div></ToolSheet>;
}

function CompletionStrip({ kind, text, commitId, onNote }: { kind: "focus" | "meditation"; text: string; commitId: string | null; onNote?: () => void }) { const router = useRouter(); const [state, setState] = useState<"idle" | "undoing" | "error" | "undone">("idle"); async function undo() { if (!commitId) return; setState("undoing"); const response = await postTool("/api/capture/undo", { commitId }); if (!response.ok) { setState("error"); return; } setState("undone"); router.refresh(); } return <div className={`mt-12 rounded-card border p-4 ${kind === "focus" ? "border-skills/40 bg-skills/10" : "border-habits/40 bg-habits/10"}`}><p className="font-ui text-body text-ink-1">{state === "undone" ? "Filed session undone." : text}</p>{state !== "undone" && <><button type="button" onClick={() => void undo()} disabled={!commitId || state === "undoing"} className={`mt-4 inline-flex min-h-11 items-center font-ui text-caption ${kind === "focus" ? "text-skills-strong" : "text-habits-strong"}`}>{state === "undoing" ? "Undoing…" : "Undo"}</button>{state === "error" && <p className="mt-2 font-ui text-caption text-danger">Undo is no longer available. Try again only if this is still your latest activity.</p>}</>}{onNote && state !== "undone" && <button type="button" onClick={onNote} className="mt-4 ml-4 inline-flex min-h-11 items-center gap-2 font-ui text-caption text-skills-strong"><Plus size={15} strokeWidth={1.5} aria-hidden />Add a note?</button>}</div>; }

function SuggestSheet({ onDone, onClose }: { onDone: () => void; onClose: () => void }) { const [text, setText] = useState(""); const id = useId(); return <ToolSheet title="Suggest a tool" onClose={onClose}><div className="mx-auto max-w-md"><p className="font-coach text-title text-ink-1">What would make your day lighter?</p><label htmlFor={id} className="sr-only">Tool suggestion</label><textarea id={id} value={text} onChange={(event) => setText(event.target.value)} className="mt-8 min-h-32 w-full resize-none rounded-input border border-line bg-card p-3 font-ui text-body text-ink-1 focus:outline-none" placeholder="A small tool you would use…" /><Button className="mt-5 min-h-12 w-full" disabled={!text.trim()} onClick={onDone}><Send size={17} strokeWidth={1.5} aria-hidden />Send suggestion</Button><p className="mt-3 font-ui text-caption text-ink-3">Kept only for this session.</p></div></ToolSheet>; }
