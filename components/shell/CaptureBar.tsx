import { Camera, Mic } from "lucide-react";

/*
 * The global capture bar — the mic entry point present on every tab (FLOWS F3).
 * SAR-005 renders the RESTING state only (static-visual); SAR-006 wires the
 * hold-to-talk / text / camera interactions and the "How'd it go?" flip.
 */
export function CaptureBar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-20 px-4 md:bottom-6 md:pl-16">
      <div className="pointer-events-auto mx-auto flex max-w-[45rem] items-center gap-3 rounded-card border border-line bg-raised p-3 shadow-[var(--elev-card)]">
        <button
          type="button"
          disabled
          aria-label="Hold to talk (available soon)"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-chip bg-ink-1 text-canvas"
        >
          <Mic size={26} strokeWidth={1.5} aria-hidden />
        </button>
        <span className="flex-1 font-ui text-body text-ink-3">Tell Sarthi about your day…</span>
        <button
          type="button"
          disabled
          aria-label="Add a photo (available soon)"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip border border-line text-ink-2"
        >
          <Camera size={20} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}
