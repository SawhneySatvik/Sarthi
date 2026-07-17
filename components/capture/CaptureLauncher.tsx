"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Mic, Send } from "lucide-react";
import { useState } from "react";

import { CaptureSheet } from "./CaptureSheet";

/*
 * The interactive capture bar + sheet host (SAR-006, D-H). Replaces the SAR-005
 * static bar. Text is the primary keyless path; the mic simulates hold-to-talk on
 * the fake stack (FakeVoiceProvider returns the canonical transcript regardless, and
 * FakeLlmGateway ignores the prompt) — real STT is SAR-013, camera is SAR-011.
 */
export function CaptureLauncher() {
  const [text, setText] = useState("");
  const [session, setSession] = useState<string | null>(null);

  function open(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setSession(trimmed);
    setText("");
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-20 px-4 md:bottom-6 md:pl-16">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            open(text);
          }}
          className="pointer-events-auto mx-auto flex max-w-[45rem] items-center gap-3 rounded-card border border-line bg-raised p-3 shadow-[var(--elev-card)]"
        >
          <button
            type="button"
            aria-label="Hold to talk"
            onClick={() => open("Voice capture")}
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
              disabled
              aria-label="Add a photo (available soon)"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip border border-line text-ink-2"
            >
              <Camera size={20} strokeWidth={1.5} aria-hidden />
            </button>
          )}
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
            <CaptureSheet key={session} rawText={session} onClose={() => setSession(null)} />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
