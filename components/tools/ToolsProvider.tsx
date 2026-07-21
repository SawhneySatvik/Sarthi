"use client";

import { Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

import { mirrorDurableState } from "@/app/lib/offline/durable-state";

type ToolKind = "focus" | "meditation";

export interface ActiveToolRun {
  kind: ToolKind;
  startedAt: number;
  durationMinutes: number;
  skillId?: string;
  skillName?: string;
  patternId?: string;
  idempotencyKey: string;
}

export function isToolRunReady(run: ActiveToolRun, now = Date.now()): boolean {
  return now - run.startedAt >= run.durationMinutes * 60000;
}

export function remainingSeconds(run: ActiveToolRun, now = Date.now()): number {
  const total = run.durationMinutes * 60;
  const elapsed = Math.floor((now - run.startedAt) / 1000);
  return Math.min(total, Math.max(0, total - elapsed));
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface ToolsContextValue {
  run: ActiveToolRun | null;
  startRun: (run: ActiveToolRun) => void;
  clearRun: () => void;
}

const STORAGE_KEY = "sarthi-tool-run";
const ToolsContext = createContext<ToolsContextValue | null>(null);

function readRun(): ActiveToolRun | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveToolRun;
    if ((parsed.kind !== "focus" && parsed.kind !== "meditation") || !Number.isInteger(parsed.durationMinutes) || parsed.durationMinutes < 1 || !Number.isFinite(parsed.startedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

let storedRun: ActiveToolRun | null = null;
let storageHydrated = false;
const runListeners = new Set<() => void>();

function notifyRun(): void { for (const listener of runListeners) listener(); }
function subscribeRun(listener: () => void): () => void {
  runListeners.add(listener);
  queueMicrotask(() => {
    if (!storageHydrated) { storedRun = readRun(); storageHydrated = true; }
    listener();
  });
  return () => runListeners.delete(listener);
}
function getRunSnapshot(): ActiveToolRun | null { return storedRun; }
function getServerRunSnapshot(): ActiveToolRun | null { return null; }

const clockListeners = new Set<() => void>();
let clockTimer: number | null = null;
let clockSnapshot = 0;
function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockSnapshot = Date.now();
    clockTimer = window.setInterval(() => {
      clockSnapshot = Date.now();
      for (const notify of clockListeners) notify();
    }, 1000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) { window.clearInterval(clockTimer); clockTimer = null; }
  };
}
function getClockSnapshot(): number { return clockSnapshot; }
function getServerClockSnapshot(): number { return 0; }

export function useClockNow(): number { return useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot); }

/** Browser-session run state only. Starts deliberately create no domain row. */
export function ToolsProvider({ children }: { children: React.ReactNode }) {
  const run = useSyncExternalStore(subscribeRun, getRunSnapshot, getServerRunSnapshot);

  const startRun = useCallback((next: ActiveToolRun) => {
    storedRun = next;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* session state remains in memory */ }
    // Additive durable mirror (T10, flag-gated): sessionStorage stays the source of truth.
    void mirrorDurableState(STORAGE_KEY, next);
    notifyRun();
  }, []);
  const clearRun = useCallback(() => {
    storedRun = null;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
    void mirrorDurableState(STORAGE_KEY, null);
    notifyRun();
  }, []);
  const value = useMemo(() => ({ run, startRun, clearRun }), [run, startRun, clearRun]);
  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useToolsRun(): ToolsContextValue {
  const value = useContext(ToolsContext);
  if (!value) throw new Error("ToolsProvider is required");
  return value;
}

/** Sits above navigation and deliberately only resumes an already-open sheet. */
export function ToolsResumeRibbon() {
  const { run } = useToolsRun();
  const router = useRouter();
  const now = useClockNow();
  if (!run) return null;
  const elapsedMinutes = Math.floor((now - run.startedAt) / 60000);
  const ready = isToolRunReady(run, now);
  const remaining = Math.max(0, run.durationMinutes - elapsedMinutes);
  const label = run.kind === "focus" ? run.skillName ?? "Focus" : "Meditation";
  return (
    <button type="button" onClick={() => router.push("/tools?resume=1")} className="fixed inset-x-4 bottom-32 z-30 mx-auto flex max-w-[45rem] items-center justify-between rounded-card border border-line bg-raised px-4 py-3 text-left shadow-[var(--elev-card)] md:bottom-6 md:left-[calc(var(--w-rail-compact)+var(--space-4))] md:right-auto md:w-[min(var(--w-reading),calc(100vw-var(--space-6)))] lg:left-[calc(var(--w-rail-expanded)+var(--space-4))] lg:w-[min(var(--w-reading),calc(100vw-var(--w-rail-expanded)-var(--space-6)))]">
      <span className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-chip ${run.kind === "focus" ? "bg-skills/20 text-skills-strong" : "bg-habits/20 text-habits-strong"}`}>{ready ? <Play size={16} strokeWidth={1.5} aria-hidden /> : <Pause size={16} strokeWidth={1.5} aria-hidden />}</span><span><span className="block font-ui text-caption text-ink-3">{ready ? "Ready to file" : "Running now"}</span><span className="block truncate font-ui text-body text-ink-1">{label}</span></span></span>
      <span className="flex items-center gap-2 font-ui text-caption tabular-nums text-ink-2">{ready ? "File" : `${remaining}m`} <Play size={15} strokeWidth={1.5} aria-hidden /></span>
    </button>
  );
}
