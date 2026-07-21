/*
 * app/onboarding/layout.tsx — UIE-5 (amends SAR-012). A standalone full-bleed shell OUTSIDE
 * the `(app)` group: no bottom nav, no capture bar, no dev switcher. The painterly backdrop
 * is now a genuine full-viewport layer (`OnboardingBackdrop`, `fixed inset-0 -z-10`) that
 * sits BEHIND the question column — the gradient placeholder is retired; ArtFrame's grained
 * plate is the only fallback. The per-phase art key is threaded from the client flow through
 * the backdrop context. The `--energy` CORE progress hairline is still rendered by the flow.
 *
 * Layout (D-050): mobile 390 = full-bleed art behind a centered `max-w-[33rem]` column (the
 * fidelity gate). At `lg:`+ a two-pane split — art celebrated on the open left pane, the
 * ~34rem question column pinned right over the backdrop's reading veil — so the desktop side
 * voids are gone.
 */
import { OnboardingBackdrop } from "@/components/onboarding/OnboardingBackdrop";
import { OnboardingColumn } from "@/components/onboarding/OnboardingColumn";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-ink-1">
      <OnboardingBackdrop>
        <OnboardingColumn>{children}</OnboardingColumn>
      </OnboardingBackdrop>
    </div>
  );
}
