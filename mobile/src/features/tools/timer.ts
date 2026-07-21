import { AppState } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

export type TimerRecord = { id: string; kind: 'focus' | 'meditation'; startedAtMs: number; durationSeconds: number; contextId?: string };
export type TimerStore = { load(kind: TimerRecord['kind']): Promise<TimerRecord | null>; save(record: TimerRecord): Promise<void>; clear(kind: TimerRecord['kind']): Promise<void> };
export type Clock = { now(): number; createId(): string };
export const wallClock: Clock = { now: () => Date.now(), createId: () => `timer_${Date.now()}_${Math.random().toString(36).slice(2)}` };

export function remainingSeconds(record: TimerRecord, nowMs: number): number { return Math.max(0, Math.ceil((record.startedAtMs + record.durationSeconds * 1000 - nowMs) / 1000)); }
export function elapsedMinutes(record: TimerRecord, nowMs: number): number { return Math.max(0, Math.floor((record.durationSeconds - remainingSeconds(record, nowMs)) / 60)); }

/** Wall-clock-derived countdown. It remains correct after backgrounding and app termination. */
export function useDurableTimer(input: { kind: TimerRecord['kind']; store: TimerStore; clock?: Clock; onElapsed: (record: TimerRecord) => void | Promise<void> }) {
  const clock = input.clock ?? wallClock; const [record, setRecord] = useState<TimerRecord | null>(null); const [remaining, setRemaining] = useState(0); const finishedRef = useRef<string | null>(null);
  const tick = useCallback(async () => { if (!record) return; const value = remainingSeconds(record, clock.now()); setRemaining(value); if (value !== 0 || finishedRef.current === record.id) return; finishedRef.current = record.id; await input.store.clear(input.kind); setRecord(null); await input.onElapsed(record); }, [clock, input, record]);
  useEffect(() => { void input.store.load(input.kind).then((saved) => { if (!saved) return; setRecord(saved); setRemaining(remainingSeconds(saved, clock.now())); }); }, [clock, input.kind, input.store]);
  useEffect(() => { void tick(); const interval = setInterval(() => void tick(), 1000); const subscription = AppState.addEventListener('change', () => void tick()); return () => { clearInterval(interval); subscription.remove(); }; }, [tick]);
  const start = useCallback(async (durationSeconds: number, contextId?: string) => { const next: TimerRecord = { id: clock.createId(), kind: input.kind, startedAtMs: clock.now(), durationSeconds, contextId }; finishedRef.current = null; await input.store.save(next); setRecord(next); setRemaining(durationSeconds); }, [clock, input.kind, input.store]);
  const stop = useCallback(async () => { if (!record) return null; const elapsed = elapsedMinutes(record, clock.now()); await input.store.clear(input.kind); setRecord(null); setRemaining(0); return { record, elapsedMinutes: elapsed }; }, [clock, input.kind, input.store, record]);
  return { record, remainingSeconds: remaining, start, stop };
}

export function formatTimer(totalSeconds: number): string { const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
