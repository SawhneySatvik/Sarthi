"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Mic, Send } from "lucide-react";
import { useRef, useState } from "react";

import { CaptureSheet, type CaptureInput } from "./CaptureSheet";

/*
 * The interactive capture bar + sheet host (SAR-006 · SAR-011). Text is the primary
 * keyless path; the mic simulates hold-to-talk on the fake stack; the camera (SAR-011)
 * opens a hidden file input, then the sheet runs the PHOTO ramp — pick/snap → preview +
 * meal/receipt toggle → parse (fake vision, keyless) → the SAME route-by-confidence
 * deck. Real STT is SAR-013; real content-based vision is a later ticket.
 */
export function CaptureLauncher() {
  const [text, setText] = useState("");
  const [session, setSession] = useState<CaptureInput | null>(null);
  const [nonce, setNonce] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input so re-picking the same file fires `change` again.
    event.target.value = "";
    if (file) openPhoto(file);
  }

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
            aria-label="Hold to talk"
            onClick={() => openText("Voice capture")}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-chip bg-ink-1 text-canvas"
          >
            <Mic size={26} strokeWidth={1.5} aria-hidden />
          </button>
          <input
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
