/*
 * Route-level loading skeleton for every (app) screen. Next renders this INSTANTLY on
 * navigation (and during the layout's per-request auth+DB read), so switching tabs never
 * freezes on a blank screen while the server resolves — it masks the cold-start (~1.5s)
 * that remains after the bom1 region fix. Shimmer via the shared `.animate-shimmer`
 * keyframe (reduced-motion suppressed in globals.css). Tokens-only.
 */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded-chip bg-raised ${className}`} aria-hidden />;
}

export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-[45rem] px-4 pt-6" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {/* header band */}
      <div className="animate-shimmer h-40 w-full rounded-card bg-raised" aria-hidden />
      <div className="mt-5 space-y-2">
        <Bar className="h-5 w-2/3" />
        <Bar className="h-5 w-1/2" />
      </div>
      {/* lens chips */}
      <div className="mt-6 flex gap-2">
        <Bar className="h-8 w-12" />
        <Bar className="h-8 w-16" />
        <Bar className="h-8 w-16" />
        <Bar className="h-8 w-16" />
        <Bar className="h-8 w-14" />
      </div>
      {/* content cards */}
      <div className="mt-6 space-y-4">
        <div className="animate-shimmer h-28 w-full rounded-card bg-raised" aria-hidden />
        <div className="animate-shimmer h-28 w-full rounded-card bg-raised" aria-hidden />
        <div className="animate-shimmer h-28 w-full rounded-card bg-raised" aria-hidden />
      </div>
    </div>
  );
}
