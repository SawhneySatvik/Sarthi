/*
 * app/onboarding/layout.tsx — SAR-012 Pass 1. A standalone full-bleed shell OUTSIDE
 * the `(app)` group: no bottom nav, no capture bar, no dev switcher — just the painterly
 * backdrop (a gradient placeholder per §2; real art lands later) under a heavy scrim for
 * AA scrim-text, and the centred question column (§11, 520px). The `--energy` CORE
 * progress hairline is rendered by the client flow (it needs progress state).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-ink-1">
      {/* Painterly backdrop placeholder — tokens only (no raw hex), so it retunes per theme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 85% at 50% 0%, var(--bg-raised), var(--bg-canvas) 62%)" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--scrim)" }} />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[33rem] flex-col px-5">
        {children}
      </div>
    </div>
  );
}
