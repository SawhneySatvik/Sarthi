/*
 * app/(auth)/layout.tsx — SAR-021. The production auth boundary (`/signup`, `/login`,
 * `/reset-password`, reset callback). A single narrow, token-driven form column on a quiet
 * canvas — no app shell, no bottom nav, no onboarding gate (these routes sit OUTSIDE the
 * `(app)` group), no developer/seed gesture, no password-gate wording. Every public auth
 * route links to Privacy and Terms without blocking conversion (SCREEN-AUTH §1).
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-canvas text-ink-1">
      <div className="mx-auto flex w-full max-w-[24rem] flex-1 flex-col justify-center px-5 py-12">
        <p className="text-center font-display text-title uppercase tracking-[0.35em] text-ink-2">
          Sarthi
        </p>
        <div className="mt-10">{children}</div>
        <nav
          aria-label="Legal"
          className="mt-10 flex items-center justify-center gap-4 font-ui text-caption text-ink-3"
        >
          <a href="/privacy" className="underline focus-visible:ring-2 focus-visible:ring-ring">
            Privacy
          </a>
          <a href="/terms" className="underline focus-visible:ring-2 focus-visible:ring-ring">
            Terms
          </a>
        </nav>
      </div>
    </main>
  );
}
