"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Mic, Send } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CaptureSheet, type CaptureInput } from "./CaptureSheet";
import { usePressToTalk } from "./usePressToTalk";
import { MAX_VOICE_DURATION_MS } from "@/core/voice";

/** A quick press switches into the documented tap-to-stop alternative. */
const TAP_TOGGLE_MS = 250;

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
  const [session, setSession] = useState<CaptureInput | null>(null);
  const [nonce, setNonce] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const pressStartedAtRef = useRef(0);

  useEffect(() => {
    if (searchParams.get("capture") !== "1") return;
    const frame = window.requestAnimationFrame(() => textInputRef.current?.focus());
    router.replace("/today", { scroll: false });
    return () => window.cancelAnimationFrame(frame);
  }, [router, searchParams]);

  useEffect(() => {
    const openNote = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const note = detail?.text?.trim();
      if (!note) return;
      setSession({ mode: "text", text: note });
      setNonce((value) => value + 1);
    };
    window.addEventListener("sarthi:capture-note", openNote);
    return () => window.removeEventListener("sarthi:capture-note", openNote);
  }, []);

  function openText(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setSession({ mode: "text", text: trimmed });
    setNonce((n) => n + 1);
    setText("");
  }

  function openPhoto(file: File) {
    setSession({ mode: "photo", file });
    setNonce((n) => n + 1);
  }

  const recorder = usePressToTalk({
    onAudio(file, durationMs) {
      setSession({ mode: "voice", file, durationMs });
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
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-20 px-4 md:bottom-6 md:pl-16">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            openText(text);
          }}
          className="pointer-events-auto mx-auto flex max-w-[45rem] items-center gap-3 rounded-card border border-line bg-raised p-3 shadow-[var(--elev-card)]"
        >
          <button
            type="button"
            aria-label={recorder.state === "tap-to-stop" ? "Stop recording" : "Hold to talk"}
            aria-pressed={recording}
            onPointerDown={startVoice}
            onPointerUp={releaseVoice}
            onPointerCancel={() => recorder.finish(true)}
            onKeyDown={keyVoice}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-chip text-canvas ${recording ? "bg-ink-2" : "bg-ink-1"}`}
          >
            <Mic size={26} strokeWidth={1.5} aria-hidden />
          </button>
          <input
            ref={textInputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell Sarthi about your day…"
            aria-label="Capture your day"
            className="flex-1 bg-transparent font-ui text-body text-ink-1 placeholder:text-ink-3 focus:outline-none"
          />
          {text ? (
            <button
              type="submit"
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-ink-1 text-canvas"
            >
              <Send size={18} strokeWidth={1.5} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Add a photo"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip border border-line text-ink-2"
            >
              <Camera size={20} strokeWidth={1.5} aria-hidden />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={onFilePicked}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />
        </form>
        {recorderMessage && (
          <div className="pointer-events-auto mx-auto mt-2 flex max-w-[45rem] items-center justify-between px-3 font-ui text-caption text-ink-2">
            <span aria-live="polite">{recorderMessage}</span>
            {recording && (
              <button type="button" onClick={() => recorder.finish(true)} className="text-ink-1 underline">
                Cancel recording
              </button>
            )}
          </div>
        )}
      </div>

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
