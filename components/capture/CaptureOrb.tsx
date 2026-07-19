export function CaptureOrb({ state = "idle", level = 0, active = false, className = "" }: { state?: "idle" | "listening" | "thinking"; level?: number; active?: boolean; className?: string }) {
  const listening = state === "listening";
  const thinking = state === "thinking" || active;
  return (
    <div className={`relative mx-auto h-24 w-24 ${listening ? "capture-orb-listening" : thinking ? "capture-orb-thinking" : ""} ${className}`} style={{ "--orb-level": level } as React.CSSProperties} aria-hidden>
      <div
        className="absolute inset-0 rounded-chip transition-opacity duration-[var(--t-slow)]"
        style={{
          background: "radial-gradient(circle at 32% 30%, var(--dom-skills), var(--dom-health))",
          opacity: listening || thinking ? 0.9 : 0.55,
        }}
      />
      <div
        className="absolute inset-3 rounded-chip"
        style={{ background: "radial-gradient(circle at 60% 65%, var(--dom-habits), transparent)", opacity: 0.35 }}
      />
    </div>
  );
}
