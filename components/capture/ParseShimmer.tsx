/** The parse state (SAR-006, D-G): skeleton cards, never a spinner. */
export function ParseShimmer() {
  return (
    <div className="flex flex-col gap-3 px-4">
      <p className="text-center font-coach text-body text-ink-2">Reading your day…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-card bg-raised" />
      ))}
    </div>
  );
}
