"use client";

import { Mic, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { transcribeVoice } from "@/components/capture/captureClient";
import { usePressToTalk } from "@/components/capture/usePressToTalk";
import { runtimeProviderHeaders } from "@/components/settings/runtimeOverride";
import { byokHeaders } from "@/components/settings/byok";
import { E1Food } from "@/components/onboarding/detail/sections/E1Food";
import { E2Screen } from "@/components/onboarding/detail/sections/E2Screen";
import { E3Focus } from "@/components/onboarding/detail/sections/E3Focus";
import { E4Career } from "@/components/onboarding/detail/sections/E4Career";
import { E5Money } from "@/components/onboarding/detail/sections/E5Money";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ArtFrame } from "@/components/art/ArtFrame";
import { relativeDay } from "@/app/lib/relativeDay";
import { formatAdaptationSnapshot, summarizeWeeklyEvidence, type CoachReadingView } from "@/core/coach";
import type { AdaptationRecord, CoachNoteRecord } from "@/data/schema/contract";
import type { OnboardingDetailInput } from "@/core/onboarding";
import { MAX_VOICE_DURATION_MS } from "@/core/voice";

const TAP_TOGGLE_MS = 250;

type BriefState = "idle" | "loading" | "failed";
type DetailSection = Extract<OnboardingDetailInput["section"], "food" | "screen" | "focus" | "career" | "money">;

function localDay() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${date}`;
}

function zone() { return Intl.DateTimeFormat().resolvedOptions().timeZone; }

function isSundayEvening() {
  const now = new Date();
  return now.getDay() === 0 && now.getHours() >= 19;
}

export function trailingWeekStart(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 6));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

async function jsonBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function detailSection(gapKey: string): DetailSection | null {
  switch (gapKey) {
    case "detail-food": return "food";
    case "detail-screen-time": return "screen";
    case "detail-focus": return "focus";
    case "detail-career": return "career";
    case "detail-money": return "money";
    default: return null;
  }
}

function RecorderMessage({ state, elapsedMs }: { state: ReturnType<typeof usePressToTalk>["state"]; elapsedMs: number }) {
  const text = state === "tap-to-stop"
    ? "Listening — tap the mic to stop"
    : state === "recording"
      ? `Recording ${Math.ceil(elapsedMs / 1000)}s / ${MAX_VOICE_DURATION_MS / 1000}s`
      : state === "requesting"
        ? "Opening microphone…"
        : state === "denied"
          ? "Microphone unavailable — try again"
          : state === "unsupported"
            ? "Voice recording isn’t supported here"
            : null;
  return text ? <p aria-live="polite" className="mt-2 font-ui text-caption text-ink-2">{text}</p> : null;
}

export function CoachReadingRoom({ initial, reentryEligible, reentry }: { initial: CoachReadingView; reentryEligible: boolean; reentry: boolean }) {
  const router = useRouter();
  const reentryPostedRef = useRef(false);
  const pressStartedAtRef = useRef(0);
  const [view, setView] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [briefState, setBriefState] = useState<BriefState>("idle");
  const [briefError, setBriefError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setView(initial);
    });
    return () => { cancelled = true; };
  }, [initial]);

  const recorder = usePressToTalk({
    onAudio: async (file, durationMs) => {
      setTranscribing(true);
      setActionError(null);
      try {
        const result = await transcribeVoice(file, durationMs);
        if (result.ok && result.transcription) setQuestion(result.transcription.text);
        else setActionError("Voice could not be transcribed. Your draft is still here.");
      } catch {
        setActionError("Voice could not be transcribed. Your draft is still here.");
      } finally {
        setTranscribing(false);
      }
    },
  });

  async function requestBrief(scope: "daily" | "weekly") {
    setBriefState("loading");
    setBriefError(null);
    try {
      const response = await fetch("/api/coach/brief", {
        method: "POST", headers: { "content-type": "application/json", ...runtimeProviderHeaders(), ...byokHeaders() },
        body: JSON.stringify({
          scope,
          localDate: scope === "weekly" ? trailingWeekStart(localDay()) : localDay(),
          timezone: zone(),
        }),
      });
      const body = await jsonBody(response);
      if (!(body && body.ok && body.note)) throw new Error("brief unavailable");
      const note = body.note as CoachNoteRecord;
      setView((current) => ({
        ...current,
        daily: note?.scope === "daily" ? note : current.daily,
        weekly: note?.scope === "weekly" ? note : current.weekly,
        ...(note.scope === "weekly" ? summarizeWeeklyEvidence(note) : {}),
      }));
      setBriefState("idle");
    } catch {
      setBriefState("failed");
      setBriefError("The last reading stays here. Retry when you’re ready.");
    }
  }

  useEffect(() => {
    const briefTimer = window.setTimeout(() => {
      void requestBrief("daily");
      if (isSundayEvening()) void requestBrief("weekly");
    }, 0);
    return () => window.clearTimeout(briefTimer);
  }, []); // The mounted reading is the one brief lifecycle.

  useEffect(() => {
    if (!reentry || !reentryEligible || reentryPostedRef.current) return;
    reentryPostedRef.current = true;
    void (async () => {
      try {
        const response = await fetch("/api/coach/adaptation", {
          method: "POST", headers: { "content-type": "application/json", ...byokHeaders() },
          body: JSON.stringify({ action: "propose-reentry", localDate: localDay() }),
        });
        const body = await jsonBody(response);
        if (!body?.ok || !body.adaptation || typeof body.adaptation !== "object") return;
        const row = body.adaptation as AdaptationRecord;
        setView((current) => current.adaptations.some((item) => item.id === row.id) ? current : ({
          ...current,
          adaptations: [{ id: row.id, label: `${formatAdaptationSnapshot(row.beforeJson)} → ${formatAdaptationSnapshot(row.afterJson)}`, before: formatAdaptationSnapshot(row.beforeJson), after: formatAdaptationSnapshot(row.afterJson), reason: row.reason, status: row.status }, ...current.adaptations],
        }));
      } catch {
        // Re-entry is additive; failure must leave the existing reading untouched.
      }
    })();
  }, [reentry, reentryEligible]);

  const adaptation = view.adaptations.find((item) => item.id === open) ?? null;
  const openDetail = view.openGap ? detailSection(view.openGap.gapKey) : null;

  async function resolve(action: "keep" | "revert") {
    if (!adaptation) return;
    setResolving(true);
    setActionError(null);
    try {
      const response = await fetch("/api/coach/adaptation", {
        method: "POST", headers: { "content-type": "application/json", ...byokHeaders() },
        body: JSON.stringify({ action, adaptationId: adaptation.id }),
      });
      const body = await jsonBody(response);
      if (!body?.ok) throw new Error("adaptation unavailable");
      setOpen(null);
      router.refresh();
    } catch {
      setActionError("That change is still visible. Try again when ready.");
    } finally {
      setResolving(false);
    }
  }

  async function saveDetail(payload: OnboardingDetailInput) {
    setDetailSaving(true);
    setActionError(null);
    try {
      const response = await fetch("/api/onboarding/detail", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await jsonBody(response);
      if (!body?.ok) throw new Error("detail unavailable");
      setDetailOpen(false);
      router.refresh();
    } catch {
      setActionError("That answer was not saved. Try again when you’re ready.");
    } finally {
      setDetailSaving(false);
    }
  }

  async function ask() {
    const text = question.trim();
    if (!text || asking) return;
    setAsking(true);
    setActionError(null);
    try {
      const response = await fetch("/api/coach/ask", {
        method: "POST", headers: { "content-type": "application/json", ...runtimeProviderHeaders(), ...byokHeaders() }, body: JSON.stringify({ text, timezone: zone() }),
      });
      const body = await jsonBody(response);
      // COACH-2 shim: the response is now `{ message, proposedAdaptation, thread }`; render the
      // coach message text in the existing single-answer slot. The persisted-thread rendering +
      // the inline proposal chip are COACH-4 — this keeps `/coach` fully working meanwhile.
      if (!body?.ok || !body.message || typeof body.message !== "object" || typeof (body.message as { text?: unknown }).text !== "string") throw new Error("ask unavailable");
      setAnswer((body.message as { text: string }).text);
      setQuestion("");
    } catch {
      setActionError("Your question was not sent; nothing was saved.");
    } finally {
      setAsking(false);
    }
  }

  function startVoice(event: React.PointerEvent<HTMLButtonElement>) {
    if (recorder.state === "tap-to-stop") { recorder.finish(false); return; }
    if (recorder.state !== "idle" && recorder.state !== "denied" && recorder.state !== "unsupported") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressStartedAtRef.current = Date.now();
    void recorder.start();
  }

  function releaseVoice() { recorder.release(Date.now() - pressStartedAtRef.current < TAP_TOGGLE_MS); }

  function keyVoice(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (event.type === "keydown") {
      if (event.repeat) return;
      if (recorder.state === "tap-to-stop") { recorder.finish(false); return; }
      if (recorder.state === "idle" || recorder.state === "denied" || recorder.state === "unsupported") {
        pressStartedAtRef.current = Date.now();
        void recorder.start();
      }
    } else {
      releaseVoice();
    }
  }

  function renderDetailForm(section: DetailSection) {
    const common = { onSave: saveDetail, onSkip: () => setDetailOpen(false), saving: detailSaving };
    switch (section) {
      case "food": return <E1Food {...common} />;
      case "screen": return <E2Screen {...common} />;
      case "focus": return <E3Focus {...common} />;
      case "career": return <E4Career {...common} skillName={null} />;
      case "money": return <E5Money {...common} />;
    }
  }

  return (
    <div className="mx-auto max-w-[38.75rem] px-4 pb-40">
      <section className="pt-5" aria-busy={briefState === "loading"}>
        <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Today</p>
        {briefState === "loading" && !view.daily ? <div aria-label="Preparing today’s reading" className="mt-3 space-y-2"><div className="h-5 w-full animate-shimmer rounded-input bg-raised" /><div className="h-5 w-4/5 animate-shimmer rounded-input bg-raised" /></div> : <p className="mt-3 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{view.daily?.text ?? "Your plan is here when you are ready. Start with one honest action."}</p>}
        {briefState === "failed" && <div className="mt-3 flex items-center gap-2"><p className="font-ui text-caption text-ink-2">{briefError}</p><button type="button" onClick={() => { void requestBrief("daily"); if (isSundayEvening()) void requestBrief("weekly"); }} className="min-h-11 font-ui text-caption text-ink-1 underline">Retry</button></div>}
        {view.openGap && <div className="mt-4"><p className="font-ui text-caption text-ink-2">{view.openGap.prompt}</p>{openDetail ? <button type="button" onClick={() => setDetailOpen((value) => !value)} className="mt-2 min-h-11 font-ui text-body text-ink-1 underline">{detailOpen ? "Keep this question open" : "Answer now"}</button> : <p className="mt-2 font-ui text-caption text-ink-2">This question stays open until you choose a goal.</p>}{detailOpen && openDetail && <div className="mt-4 border-t border-line pt-4">{renderDetailForm(openDetail)}</div>}</div>}
        {view.adaptations.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{view.adaptations.map((item) => <Chip key={item.id} onClick={() => setOpen(item.id)} className="max-w-full whitespace-normal break-words text-left">{item.label}{item.status === "proposed" ? " · pending" : ""}</Chip>)}</div>}
      </section>

      {view.weekly && <section className="mt-8 overflow-hidden rounded-card border border-line bg-card shadow-[var(--elev-card)]"><ArtFrame artKey="coach.week_band" ratio="h-10 rounded-none border-0" /><div className="p-5"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">This week</p><div className="mt-4 space-y-3">{view.weeklyDomainLines.map((line) => <div key={line.domain} className="border-b border-line pb-3 last:border-b-0"><p className="font-ui text-caption uppercase tracking-wide text-ink-2">{line.domain}</p><p className="mt-1 font-ui text-body text-ink-1">{line.text}</p><p className="mt-1 font-ui text-caption text-ink-3">{line.count} entries · trend recorded in this week’s evidence</p></div>)}</div><p className="mt-4 font-ui text-caption uppercase tracking-wide text-ink-3">Coach observation</p><p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{view.weekly.text}</p>{view.adaptations[0] && <button type="button" onClick={() => setOpen(view.adaptations[0].id)} className="mt-4 min-h-11 font-ui text-body text-ink-1 underline">Adjustment · {view.adaptations[0].label}</button>}<p className="mt-4 font-ui text-caption text-ink-3">Based on {view.evidenceCount} typed entries</p></div></section>}

      <section className="mt-8"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">Earlier</p>{view.history.map((note) => <details key={note.id} className="border-b border-line py-3"><summary className="cursor-pointer font-ui text-body text-ink-2">{relativeDay(note.localDate)} · {note.scope}</summary><p className="mt-3 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{note.text}</p></details>)}</section>
      {answer && <p className="mt-6 font-coach text-body leading-[var(--leading-coach)] text-ink-2">{answer}</p>}
      {actionError && <p role="status" className="mt-3 font-ui text-caption text-ink-2">{actionError}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-20 border-t border-line bg-canvas p-3 md:bottom-0"><div className="mx-auto flex max-w-[38.75rem] items-center gap-2"><input aria-label="Ask your coach" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void ask(); } }} placeholder="Ask your coach…" className="min-h-11 min-w-0 flex-1 rounded-input border border-line bg-raised px-3 font-ui text-body text-ink-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" /><button type="button" aria-label={recorder.state === "tap-to-stop" ? "Stop recording" : "Hold to talk"} aria-pressed={recorder.state === "recording" || recorder.state === "tap-to-stop" || recorder.state === "requesting"} onPointerDown={startVoice} onPointerUp={releaseVoice} onPointerCancel={() => recorder.finish(true)} onKeyDown={keyVoice} onKeyUp={keyVoice} onContextMenu={(event) => event.preventDefault()} className="flex h-11 w-11 items-center justify-center rounded-chip text-ink-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mic size={18} strokeWidth={1.5} /></button><button type="button" aria-label="Send question" disabled={asking || transcribing || !question.trim()} onClick={() => void ask()} className="flex h-11 w-11 items-center justify-center rounded-chip bg-raised text-ink-1 disabled:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Send size={18} strokeWidth={1.5} /></button></div>{transcribing ? <p aria-live="polite" className="mx-auto mt-2 max-w-[38.75rem] font-ui text-caption text-ink-2">Turning your voice into an editable question…</p> : <div className="mx-auto max-w-[38.75rem]"><RecorderMessage state={recorder.state} elapsedMs={recorder.elapsedMs} /></div>}</div>

      {adaptation && <div role="dialog" aria-modal="true" aria-label="Adaptation" className="fixed inset-0 z-40 flex items-end bg-[var(--scrim)] p-4 md:items-center md:justify-center"><div className="w-full max-w-md rounded-card bg-card p-5"><button type="button" aria-label="Close adaptation" disabled={resolving} onClick={() => setOpen(null)} className="float-right min-h-11 min-w-11 text-ink-2"><X size={18} strokeWidth={1.5} /></button><p className="font-ui text-caption uppercase tracking-wide text-ink-3">Visible plan change</p><p className="mt-4 font-ui text-body text-ink-2">Before</p><p className="font-display text-title text-ink-1">{adaptation.before}</p><p className="mt-3 font-ui text-body text-ink-2">After</p><p className="font-display text-title text-ink-1">{adaptation.after}</p><p className="mt-4 font-coach text-body leading-[var(--leading-coach)] text-ink-2">{adaptation.reason}</p><div className="mt-6 flex gap-2"><Button disabled={resolving || adaptation.status !== "proposed"} onClick={() => void resolve("keep")}>Keep</Button><Button variant="ghost" disabled={resolving || adaptation.status !== "proposed"} onClick={() => void resolve("revert")}>Revert</Button></div></div></div>}
    </div>
  );
}
