/*
 * Static Capture Orb (SAR-006, D-G). Layered token-driven gradient — NOT a WebGL
 * shader (three.js is deferred until after F3, D-024). The static fallback is the
 * shipped path per AGENTS.md §4 step 5.
 */
export function CaptureOrb({ active = false }: { active?: boolean }) {
  return (
    <div className="relative mx-auto h-24 w-24" aria-hidden>
      <div
        className="absolute inset-0 rounded-chip transition-opacity duration-[var(--t-slow)]"
        style={{
          background: "radial-gradient(circle at 32% 30%, var(--dom-skills), var(--dom-health))",
          opacity: active ? 0.9 : 0.55,
        }}
      />
      <div
        className="absolute inset-3 rounded-chip"
        style={{ background: "radial-gradient(circle at 60% 65%, var(--dom-habits), transparent)", opacity: 0.35 }}
      />
    </div>
  );
}
