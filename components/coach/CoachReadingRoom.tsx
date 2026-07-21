"use client";

import { Check, Mic, Send, X } from "lucide-react";
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
import { formatAdaptationSnapshot, summarizeWeeklyEvidence, type CoachMemoryProposalView, type CoachReadingView, type CoachThreadMessage } from "@/core/coach";
import type { AdaptationRecord, CoachNoteRecord } from "@/data/schema/contract";
import type { OnboardingDetailInput } from "@/core/onboarding";
import { MAX_VOICE_DURATION_MS } from "@/core/voice";

const TAP_TOGGLE_MS = 250;

type BriefState = "idle" | "loading" | "failed";
type DetailSection = Extract<OnboardingDetailInput["section"], "food" | "screen" | "focus" | "career" | "money">;
type PinnedMemoryDisplay = { id: string; domain: string; kind: string; text: string };

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

export function CoachReadingRoom({ initial, reentryEligible, reentry, pinnedMemories }: { initial: CoachReadingView; reentryEligible: boolean; reentry: boolean; pinnedMemories: readonly PinnedMemoryDisplay[] }) {
  const router = useRouter();
  const reentryPostedRef = useRef(false);
  const pressStartedAtRef = useRef(0);
  const [view, setView] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [online, setOnline] = useState(true);
  // COACH-7 populates these inferred-memory confirm cards; the C4 surface just renders them
  // (and renders nothing while empty). No dead placeholder UI until real data arrives.
  const [memoryProposals, setMemoryProposals] = useState<readonly CoachMemoryProposalView[]>([]);
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

  // Online-only coach (§2.6): the composer, mic, send, brief Retry, Keep/Revert and memory
  // cards all disable offline; the persisted thread + notes stay readable. Nothing queues.
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

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
  // A conversation proposal renders inline in the thread; keep it OUT of the top chips so the
  // same proposal is never shown twice. Re-entry proposals (no thread message) stay at top.
  const threadProposalIds = new Set(view.thread.filter((message) => message.proposedAdaptationId).map((message) => message.proposedAdaptationId as string));
  const topAdaptations = view.adaptations.filter((item) => !threadProposalIds.has(item.id));
  const proposedAdaptations = view.adaptations.filter((item) => item.status === "proposed");

  async function resolve(action: "keep" | "revert") {
    if (!adaptation || !online) return;
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
    if (!text || asking || !online) return;
    setAsking(true);
    setActionError(null);
    // Optimistically append the user's turn (temp id) so the thread echoes it instantly.
    const optimisticId = `local-${Date.now()}`;
    const optimistic: CoachThreadMessage = { id: optimisticId, role: "user", text, localDate: localDay(), createdAt: new Date().toISOString(), proposedAdaptationId: null };
    setView((current) => ({ ...current, thread: [...current.thread, optimistic] }));
    setQuestion("");
    try {
      const response = await fetch("/api/coach/ask", {
        method: "POST", headers: { "content-type": "application/json", ...runtimeProviderHeaders(), ...byokHeaders() }, body: JSON.stringify({ text, timezone: zone() }),
      });
      const body = await jsonBody(response);
      // COACH-4: the response is `{ message, proposedAdaptation, thread }`. The coach reply
      // carries its own (nullable) proposedAdaptationId; when a proposal was created, the
      // inline chip's Keep/Revert dialog needs the row's before/after snapshot — which lives
      // only in the loader's `adaptations` — so refresh to pull thread + adaptation atomically.
      if (!body?.ok || !body.message || typeof body.message !== "object" || typeof (body.message as { text?: unknown }).text !== "string") throw new Error("ask unavailable");
      if (body.proposedAdaptation) {
        router.refresh();
      } else if (Array.isArray(body.thread)) {
        const thread = body.thread as CoachThreadMessage[];
        setView((current) => ({ ...current, thread }));
      } else {
        const message = body.message as CoachThreadMessage;
        setView((current) => ({ ...current, thread: [...current.thread, message] }));
      }
    } catch {
      // Roll the optimistic turn back and restore the draft — nothing was saved.
      setView((current) => ({ ...current, thread: current.thread.filter((message) => message.id !== optimisticId) }));
      setQuestion(text);
      setActionError("Your question was not sent; nothing was saved.");
    } finally {
      setAsking(false);
    }
  }

  // COACH-7 confirm-card resolve. Endpoint shape mirrors the adaptation route (a guess until
  // C7 lands its route): POST /api/coach/memory { action, memoryId }. Never fires in C4 (the
  // list is empty); wired so the surface is complete. Coach mutation → online-only.
  async function resolveMemory(id: string, action: "confirm" | "discard") {
    if (!online) return;
    setActionError(null);
    setMemoryProposals((current) => current.filter((proposal) => proposal.id !== id));
    try {
      const response = await fetch("/api/coach/memory", {
        method: "POST", headers: { "content-type": "application/json", ...byokHeaders() }, body: JSON.stringify({ action, memoryId: id }),
      });
      const body = await jsonBody(response);
      if (!body?.ok) throw new Error("memory unavailable");
    } catch {
      setActionError("That memory card is still here. Try again when you’re ready.");
      router.refresh();
    }
  }

  function startVoice(event: React.PointerEvent<HTMLButtonElement>) {
    if (!online) return;
    if (recorder.state === "tap-to-stop") { recorder.finish(false); return; }
    if (recorder.state !== "idle" && recorder.state !== "denied" && recorder.state !== "unsupported") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressStartedAtRef.current = Date.now();
    void recorder.start();
  }

  function releaseVoice() { recorder.release(Date.now() - pressStartedAtRef.current < TAP_TOGGLE_MS); }

  function keyVoice(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    if (!online) return;
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
    <div className="mx-auto max-w-[38.75rem] px-4 pb-40 lg:grid lg:max-w-[var(--w-canvas)] lg:grid-cols-[minmax(0,var(--w-reading))_minmax(0,1fr)] lg:gap-[var(--space-6)]">
      <div>
      <section className="pt-5" aria-busy={briefState === "loading"}>
        <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Today</p>
        {briefState === "loading" && !view.daily ? <div aria-label="Preparing today’s reading" className="mt-3 space-y-2"><div className="h-5 w-full animate-shimmer rounded-input bg-raised" /><div className="h-5 w-4/5 animate-shimmer rounded-input bg-raised" /></div> : <p className="mt-3 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{view.daily?.text ?? "Your plan is here when you are ready. Start with one honest action."}</p>}
        {briefState === "failed" && <div className="mt-3 flex items-center gap-2"><p className="font-ui text-caption text-ink-2">{briefError}</p><button type="button" disabled={!online} onClick={() => { void requestBrief("daily"); if (isSundayEvening()) void requestBrief("weekly"); }} className="min-h-11 font-ui text-caption text-ink-1 underline disabled:text-ink-3 disabled:no-underline">Retry</button></div>}
        {view.openGap && <div className="mt-4"><p className="font-ui text-caption text-ink-2">{view.openGap.prompt}</p>{openDetail ? <button type="button" onClick={() => setDetailOpen((value) => !value)} className="mt-2 min-h-11 font-ui text-body text-ink-1 underline">{detailOpen ? "Keep this question open" : "Answer now"}</button> : <p className="mt-2 font-ui text-caption text-ink-2">This question stays open until you choose a goal.</p>}{detailOpen && openDetail && <div className="mt-4 border-t border-line pt-4">{renderDetailForm(openDetail)}</div>}</div>}
        {topAdaptations.length > 0 && <div className="mt-4 flex flex-wrap gap-2 lg:hidden">{topAdaptations.map((item) => <Chip key={item.id} onClick={() => setOpen(item.id)} className="max-w-full whitespace-normal break-words text-left">{item.label}{item.status === "proposed" ? " · pending" : ""}</Chip>)}</div>}
        {topAdaptations.some((item) => item.status !== "proposed") && <div className="hidden lg:mt-4 lg:flex lg:flex-wrap lg:gap-2">{topAdaptations.filter((item) => item.status !== "proposed").map((item) => <Chip key={item.id} onClick={() => setOpen(item.id)} className="max-w-full whitespace-normal break-words text-left">{item.label}</Chip>)}</div>}
      </section>

      {memoryProposals.length > 0 && (
        <section className="mt-8">
          <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Coach memory</p>
          <p className="mt-1 font-ui text-caption text-ink-2">Keep the ones that ring true. Nothing is remembered until you say so.</p>
          <div className="mt-4 space-y-3">
            {memoryProposals.map((proposal) => (
              <div key={proposal.id} className="rounded-card border border-line bg-card p-5 shadow-[var(--elev-card)]">
                <div className="flex items-center justify-between">
                  <span className="font-ui text-caption uppercase tracking-wide text-ink-3">{proposal.domain} · {proposal.kind}</span>
                  <span className="font-ui text-caption tabular-nums text-ink-3">{proposal.confidencePct}%</span>
                </div>
                <p className="mt-3 font-coach text-body leading-[var(--leading-coach)] text-ink-1">The coach thinks: {proposal.text}. Keep it?</p>
                <div className="mt-4 flex items-center justify-center gap-6">
                  <button type="button" aria-label="Discard memory" disabled={!online} onClick={() => void resolveMemory(proposal.id, "discard")} className="flex h-11 w-11 items-center justify-center rounded-chip border border-line text-ink-2 disabled:opacity-40"><X size={20} strokeWidth={1.5} aria-hidden /></button>
                  <button type="button" aria-label="Keep memory" disabled={!online} onClick={() => void resolveMemory(proposal.id, "confirm")} className="flex h-11 w-11 items-center justify-center rounded-chip bg-ink-1 text-canvas disabled:opacity-40"><Check size={20} strokeWidth={1.5} aria-hidden /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view.weekly && <section className="mt-8 overflow-hidden rounded-card border border-line bg-card shadow-[var(--elev-card)]"><ArtFrame artKey="coach.week_band" ratio="h-10 rounded-none border-0" /><div className="p-5"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">This week</p><div className="mt-4 space-y-3">{view.weeklyDomainLines.map((line) => <div key={line.domain} className="border-b border-line pb-3 last:border-b-0"><p className="font-ui text-caption uppercase tracking-wide text-ink-2">{line.domain}</p><p className="mt-1 font-ui text-body text-ink-1">{line.text}</p><p className="mt-1 font-ui text-caption text-ink-3">{line.count} entries · trend recorded in this week’s evidence</p></div>)}</div><p className="mt-4 font-ui text-caption uppercase tracking-wide text-ink-3">Coach observation</p><p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{view.weekly.text}</p>{topAdaptations[0] && <button type="button" onClick={() => setOpen(topAdaptations[0].id)} className={`mt-4 min-h-11 font-ui text-body text-ink-1 underline${topAdaptations[0].status === "proposed" ? " lg:hidden" : ""}`}>Adjustment · {topAdaptations[0].label}</button>}<p className="mt-4 font-ui text-caption text-ink-3">Based on {view.evidenceCount} typed entries</p></div></section>}

      <section className="mt-8"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">Earlier</p>{view.history.map((note) => <details key={note.id} className="border-b border-line py-3"><summary className="cursor-pointer font-ui text-body text-ink-2">{relativeDay(note.localDate)} · {note.scope}</summary><p className="mt-3 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{note.text}</p></details>)}</section>
      {view.thread.length > 0 && (
        <section className="mt-8">
          <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Conversation</p>
          <div className="mt-4 space-y-4">
            {view.thread.map((message) => {
              if (message.role === "user") {
                return <div key={message.id} className="flex justify-end"><p className="max-w-[85%] rounded-card bg-raised px-4 py-2 font-ui text-body text-ink-2">{message.text}</p></div>;
              }
              const proposed = message.proposedAdaptationId ? view.adaptations.find((item) => item.id === message.proposedAdaptationId) ?? null : null;
              return (
                <div key={message.id} className="max-w-[85%]">
                  <p className="font-coach text-body leading-[var(--leading-coach)] text-ink-1">{message.text}</p>
                  {proposed && <div className={`mt-2${proposed.status === "proposed" ? " lg:hidden" : ""}`}><Chip onClick={() => setOpen(proposed.id)} className="max-w-full whitespace-normal break-words text-left">{proposed.label}{proposed.status === "proposed" ? " · pending" : ""}</Chip></div>}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {actionError && <p role="status" className="mt-3 font-ui text-caption text-ink-2">{actionError}</p>}
      </div>

      <aside aria-label="Coach context" className="sticky top-[var(--space-6)] hidden self-start border-l border-line pl-[var(--space-5)] lg:block">
        <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Coach context</p>
        {pinnedMemories.length > 0 && <section className="mt-5"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">Remembered</p><div className="mt-3 divide-y divide-line">{pinnedMemories.map((memory) => <div key={memory.id} className="py-3 first:pt-0"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">{memory.domain} · {memory.kind}</p><p className="mt-1 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{memory.text}</p></div>)}</div></section>}
        {proposedAdaptations.length > 0 && <section className="mt-6"><p className="font-ui text-caption uppercase tracking-wide text-ink-3">Pending changes</p><div className="mt-3 flex flex-wrap gap-2">{proposedAdaptations.map((item) => <Chip key={item.id} onClick={() => setOpen(item.id)} className="max-w-full whitespace-normal break-words text-left">{item.label} · pending</Chip>)}</div></section>}
      </aside>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-20 border-t border-line bg-canvas p-3 md:bottom-0 lg:pl-[max(calc(var(--w-rail-expanded)+var(--space-4)),calc((100vw-var(--w-canvas)+var(--w-rail-expanded))/2+var(--space-4)))]"><div className="mx-auto flex max-w-[38.75rem] items-center gap-2 lg:mx-0 lg:max-w-[var(--w-reading)]"><input aria-label="Ask your coach" value={question} disabled={!online} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void ask(); } }} placeholder="Ask your coach…" className="min-h-11 min-w-0 flex-1 rounded-input border border-line bg-raised px-3 font-ui text-body text-ink-1 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-ink-3" /><button type="button" aria-label={recorder.state === "tap-to-stop" ? "Stop recording" : "Hold to talk"} aria-pressed={recorder.state === "recording" || recorder.state === "tap-to-stop" || recorder.state === "requesting"} disabled={!online} onPointerDown={startVoice} onPointerUp={releaseVoice} onPointerCancel={() => recorder.finish(true)} onKeyDown={keyVoice} onKeyUp={keyVoice} onContextMenu={(event) => event.preventDefault()} className="flex h-11 w-11 items-center justify-center rounded-chip text-ink-2 disabled:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mic size={18} strokeWidth={1.5} /></button><button type="button" aria-label="Send question" disabled={asking || transcribing || !question.trim() || !online} onClick={() => void ask()} className="flex h-11 w-11 items-center justify-center rounded-chip bg-raised text-ink-1 disabled:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Send size={18} strokeWidth={1.5} /></button></div>{!online ? <p role="status" className="mx-auto mt-2 max-w-[38.75rem] font-ui text-caption text-ink-2 lg:mx-0 lg:max-w-[var(--w-reading)]">Your coach needs a connection. Your recorded history stays readable.</p> : transcribing ? <p aria-live="polite" className="mx-auto mt-2 max-w-[38.75rem] font-ui text-caption text-ink-2 lg:mx-0 lg:max-w-[var(--w-reading)]">Turning your voice into an editable question…</p> : <div className="mx-auto max-w-[38.75rem] lg:mx-0 lg:max-w-[var(--w-reading)]"><RecorderMessage state={recorder.state} elapsedMs={recorder.elapsedMs} /></div>}</div>

      {adaptation && <div role="dialog" aria-modal="true" aria-label="Adaptation" className="fixed inset-0 z-40 flex items-end bg-[var(--scrim)] p-4 md:items-center md:justify-center"><div className="w-full max-w-md rounded-card bg-card p-5"><button type="button" aria-label="Close adaptation" disabled={resolving} onClick={() => setOpen(null)} className="float-right min-h-11 min-w-11 text-ink-2"><X size={18} strokeWidth={1.5} /></button><p className="font-ui text-caption uppercase tracking-wide text-ink-3">Visible plan change</p><p className="mt-4 font-ui text-body text-ink-2">Before</p><p className="font-display text-title text-ink-1">{adaptation.before}</p><p className="mt-3 font-ui text-body text-ink-2">After</p><p className="font-display text-title text-ink-1">{adaptation.after}</p><p className="mt-4 font-coach text-body leading-[var(--leading-coach)] text-ink-2">{adaptation.reason}</p><div className="mt-6 flex gap-2"><Button disabled={resolving || adaptation.status !== "proposed" || !online} onClick={() => void resolve("keep")}>Keep</Button><Button variant="ghost" disabled={resolving || adaptation.status !== "proposed" || !online} onClick={() => void resolve("revert")}>Revert</Button></div></div></div>}
    </div>
  );
}
