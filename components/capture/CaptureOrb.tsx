export function CaptureOrb({ state = "idle", level = 0, active = false, className = "" }: { state?: "idle" | "listening" | "thinking"; level?: number; active?: boolean; className?: string }) {
  const listening = state === "listening";
  const thinking = state === "thinking" || active;
  const lit = listening || thinking;
  return (
    <div
      className={`relative mx-auto h-24 w-24 ${listening ? "capture-orb-listening" : thinking ? "capture-orb-thinking" : ""} ${className}`}
      style={{ "--orb-level": level } as React.CSSProperties}
      aria-hidden
    >
      {/* Soft outer halo — a diffuse bloom that lifts the orb off the sheet. Brightens
          when the orb is live (listening/thinking) via the shared opacity transition. */}
      <div
        className="absolute -inset-5 rounded-chip blur-2xl transition-opacity duration-[var(--t-slow)]"
        style={{
          background: "radial-gradient(circle at 42% 36%, var(--dom-skills), transparent 68%)",
          opacity: listening ? 0.55 : thinking ? 0.42 : 0.3,
        }}
      />
      {/* Core gradient (skills → health). */}
      <div
        className="absolute inset-0 rounded-chip transition-opacity duration-[var(--t-slow)]"
        style={{
          background: "radial-gradient(circle at 32% 30%, var(--dom-skills), var(--dom-health))",
          opacity: lit ? 0.95 : 0.7,
        }}
      />
      {/* Inner warmth (habits) for depth. */}
      <div
        className="absolute inset-3 rounded-chip"
        style={{ background: "radial-gradient(circle at 60% 65%, var(--dom-habits), transparent)", opacity: 0.4 }}
      />
      {/* Top-left specular highlight — makes it read as a glassy sphere. */}
      <div
        className="absolute inset-0 rounded-chip"
        style={{
          background: "radial-gradient(circle at 30% 24%, color-mix(in oklab, white 60%, transparent), transparent 44%)",
          opacity: 0.5,
        }}
      />
    </div>
  );
}
