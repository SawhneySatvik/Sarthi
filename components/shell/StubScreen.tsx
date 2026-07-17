import { AppHeader } from "./AppHeader";

/** Placeholder for a tab whose real screen lands in a later ticket (SAR-008+). */
export function StubScreen({ title, blurb }: { title: string; blurb: string }) {
  return (
    <>
      <AppHeader title={title} />
      <div className="px-4 pt-12 text-center">
        <p className="font-ui text-body text-ink-2">{blurb}</p>
        <p className="mt-2 font-ui text-caption text-ink-3">Coming in a later ticket.</p>
      </div>
    </>
  );
}
