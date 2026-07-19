"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Pencil, Send, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CaptureSheet, type CaptureInput } from "./CaptureSheet";
import { CaptureOrb } from "./CaptureOrb";
import { usePressToTalk } from "./usePressToTalk";
import { MAX_VOICE_DURATION_MS } from "@/core/voice";

/** A quick press switches into the documented tap-to-stop alternative. */
const TAP_TOGGLE_MS = 250;
const CAPTURE_HINTS = [
  { label: "Log a Meal", prompt: "Meal: " },
  { label: "Add Expense", prompt: "Expense: " },
  { label: "Capture Thought", prompt: "Thought: " },
  { label: "Create Reminder", prompt: "Reminder: " },
] as const;

interface LastActivity { caption: string | null; domain: string; localDate: string; }

/*
 * The interactive capture bar + sheet host (SAR-006 · SAR-011). Text is the primary
 * keyless path; the mic records an ephemeral browser clip; the camera (SAR-011)
 * opens a hidden file input, then the sheet runs the PHOTO ramp — pick/snap → preview +
 * meal/receipt toggle → parse (fake vision, keyless) → the SAME route-by-confidence
 * deck. Real STT is SAR-013; real content-based vision is a later ticket.
 */
export function CaptureLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [text, setText] = useState("");
  const [contextPrompt, setContextPrompt] = useState<string | null>(null);
  const [session, setSession] = useState<CaptureInput | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [lastActivity, setLastActivity] = useState<LastActivity | null>(null);
  const [nonce, setNonce] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const pressStartedAtRef = useRef(0);
  const contextTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (searchParams.get("capture") !== "1") return;
    const frame = window.requestAnimationFrame(() => {
      setComposerOpen(true);
      window.requestAnimationFrame(() => textInputRef.current?.focus());
    });
    router.replace("/today", { scroll: false });
    return () => window.cancelAnimationFrame(frame);
  }, [router, searchParams]);

  useEffect(() => {
    const openNote = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const note = detail?.text?.trim();
      if (!note) return;
      setSession({ mode: "text", text: note });
      setComposerOpen(false);
      setNonce((value) => value + 1);
    };
    window.addEventListener("sarthi:capture-note", openNote);
    return () => window.removeEventListener("sarthi:capture-note", openNote);
  }, []);

  useEffect(() => {
    if (!composerOpen) return;
    let current = true;
    void fetch("/api/capture/last-activity")
      .then(async (response) => response.ok ? response.json() as Promise<{ activity: LastActivity | null }> : null)
      .then((payload) => { if (current) setLastActivity(payload?.activity ?? null); })
      .catch(() => { if (current) setLastActivity(null); });
    return () => { current = false; };
  }, [composerOpen]);

  useEffect(() => {
    const setContext = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (!prompt) return;
      if (contextTimerRef.current !== null) window.clearTimeout(contextTimerRef.current);
      setContextPrompt(prompt);
      contextTimerRef.current = window.setTimeout(() => {
        setContextPrompt(null);
        contextTimerRef.current = null;
      }, 30000);
    };
    window.addEventListener("sarthi:capture-context", setContext);
    return () => {
      window.removeEventListener("sarthi:capture-context", setContext);
      if (contextTimerRef.current !== null) window.clearTimeout(contextTimerRef.current);
    };
  }, []);

  function openText(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setSession({ mode: "text", text: trimmed });
    setComposerOpen(false);
    setNonce((n) => n + 1);
    setText("");
  }

  function openPhoto(file: File) {
    setSession({ mode: "photo", file });
    setComposerOpen(false);
    setNonce((n) => n + 1);
  }

  const recorder = usePressToTalk({
    onAudio(file, durationMs) {
      setSession({ mode: "voice", file, durationMs });
      setComposerOpen(false);
      setNonce((n) => n + 1);
    },
  });

  function startVoice(event: React.PointerEvent<HTMLButtonElement>) {
    if (recorder.state === "tap-to-stop") {
      recorder.finish(false);
      return;
    }
    if (recorder.state !== "idle" && recorder.state !== "denied" && recorder.state !== "unsupported") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressStartedAtRef.current = Date.now();
    void recorder.start();
  }

  function releaseVoice() {
    const quick = Date.now() - pressStartedAtRef.current < TAP_TOGGLE_MS;
    recorder.release(quick);
  }

  /** Keyboard is the explicit tap-to-toggle alternative. Preventing native button
   * activation keeps Space/Enter from synthesising an additional click gesture. */
  function keyVoice(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (recorder.state === "tap-to-stop") {
      recorder.finish(false);
      return;
    }
    if (recorder.state === "idle" || recorder.state === "denied" || recorder.state === "unsupported") {
      pressStartedAtRef.current = Date.now();
      void recorder.start();
    }
  }

  const recording = recorder.state === "recording" || recorder.state === "tap-to-stop" || recorder.state === "requesting";
  const recorderMessage =
    recorder.state === "tap-to-stop"
      ? "Listening — tap mic to stop"
      : recorder.state === "recording"
        ? `Recording ${Math.ceil(recorder.elapsedMs / 1000)}s / ${MAX_VOICE_DURATION_MS / 1000}s`
        : recorder.state === "requesting"
          ? "Opening microphone…"
          : recorder.state === "denied"
            ? "Microphone unavailable — try again"
            : recorder.state === "unsupported"
              ? "Voice recording isn’t supported here"
              : null;

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input so re-picking the same file fires `change` again.
    event.target.value = "";
    if (file) openPhoto(file);
  }

  if (pathname === "/coach") return null;

  return (
    <>
      {/*
       * Opaque backing that occludes scrolling content ghosting through the gap
       * between the floating capture bar (z-20, bottom-16) and the bottom nav
       * (z-30, bottom-0/64px). Sits below both (z-10); the opaque nav overdraws
       * its bottom edge. Canvas→transparent fade keeps the Premium Dark feel.
       */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-32"
        style={{ background: "linear-gradient(to top, var(--bg-canvas) 70%, transparent)" }}
      />
      {!composerOpen && <button type="button" onClick={() => setComposerOpen(true)} aria-label="Open capture" className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-chip border border-canvas bg-ink-1 text-canvas shadow-[var(--elev-card)] md:bottom-6 md:right-8"><Pencil size={22} strokeWidth={1.5} aria-hidden /></button>}
      <AnimatePresence>{composerOpen && <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setComposerOpen(false)} className="fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-sm" />
        <motion.section
          role="dialog" aria-modal="true" aria-labelledby="capture-title"
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}
          drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.12}
          onDragEnd={(_, info) => { if (info.offset.y > 96 || info.velocity.y > 680) setComposerOpen(false); }}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[88dvh] max-w-[45rem] flex-col rounded-t-card border border-line bg-raised px-4 pb-[max(env(safe-area-inset-bottom),var(--space-4))] shadow-[var(--elev-card)]"
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-chip bg-line" aria-hidden />
          <header className="flex items-center justify-between py-4"><h2 id="capture-title" className="font-display text-title text-ink-1">What happened?</h2><button type="button" onClick={() => setComposerOpen(false)} aria-label="Close capture" className="flex min-h-11 min-w-11 items-center justify-center rounded-chip text-ink-2"><X size={18} strokeWidth={1.5} aria-hidden /></button></header>
          <div className="flex flex-1 flex-col justify-center">
            <button type="button" aria-label={recorder.state === "tap-to-stop" ? "Stop recording" : "Hold to talk"} aria-pressed={recording} onPointerDown={startVoice} onPointerUp={releaseVoice} onPointerCancel={() => recorder.finish(true)} onKeyDown={keyVoice} onContextMenu={(event) => event.preventDefault()} className="mx-auto flex min-h-44 min-w-44 items-center justify-center rounded-chip focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CaptureOrb state={recording ? "listening" : "idle"} level={recorder.audioLevel} className="h-40 w-40" />
              <span className="sr-only">{recording ? "Listening" : "Hold to talk"}</span>
            </button>
            <p className="mt-4 text-center font-ui text-caption text-ink-2" aria-live="polite">{recorderMessage ?? "Hold the orb to talk, or use text and photo below."}</p>
            {recording && <button type="button" onClick={() => recorder.finish(true)} className="mt-2 self-center font-ui text-caption text-ink-2 underline">Cancel recording</button>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3" aria-label="Capture hints">{CAPTURE_HINTS.map((hint) => <button key={hint.label} type="button" onClick={() => { setText(hint.prompt); textInputRef.current?.focus(); }} className="min-h-11 shrink-0 rounded-chip border border-line bg-card px-3 font-ui text-caption text-ink-2">{hint.label}</button>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); openText(text); }} className="flex items-center gap-2 rounded-card border border-line bg-card p-3">
            <input ref={textInputRef} value={text} onChange={(event) => setText(event.target.value)} placeholder={contextPrompt ?? "Tell Sarthi about your day…"} aria-label="Capture your day" className="min-h-11 min-w-0 flex-1 bg-transparent font-ui text-body text-ink-1 placeholder:text-ink-3 focus:outline-none" />
            <button type="button" aria-label="Add a photo" onClick={() => fileInputRef.current?.click()} className="flex min-h-11 min-w-11 items-center justify-center rounded-chip border border-line text-ink-2"><Camera size={20} strokeWidth={1.5} aria-hidden /></button>
            <button type="submit" aria-label="Send" disabled={!text.trim()} className="flex min-h-11 min-w-11 items-center justify-center rounded-chip bg-ink-1 text-canvas disabled:opacity-50"><Send size={18} strokeWidth={1.5} aria-hidden /></button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onFilePicked} className="hidden" aria-hidden tabIndex={-1} />
          </form>
          <p className="mt-3 font-ui text-caption text-ink-3">{lastActivity ? `Last activity · ${lastActivity.caption ?? `${lastActivity.domain} capture`} · ${lastActivity.localDate}` : "No captured activity yet."}</p>
        </motion.section>
      </>}</AnimatePresence>

      <AnimatePresence>
        {session && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSession(null)}
              className="fixed inset-0 z-40"
              style={{ background: "var(--scrim)" }}
            />
            <CaptureSheet key={nonce} input={session} onClose={() => setSession(null)} />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
