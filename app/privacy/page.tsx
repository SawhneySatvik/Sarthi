import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · Sarthi",
  description: "How Sarthi handles your data.",
};

/*
 * app/privacy/page.tsx — a minimal, accurate privacy stub (PL-2 / legal stubs). Linked from the
 * auth pages and Settings. Public (no auth). Tokens-only, Bone; no new design system.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-canvas px-5 py-12 text-ink-1 sm:px-8">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="font-ui text-caption font-medium uppercase tracking-[0.14em] text-ink-3">Sarthi</p>
          <h1 className="font-display text-display text-ink-1">Privacy</h1>
          <p className="font-ui text-caption text-ink-3">Last updated 20 July 2026</p>
        </header>

        <p className="font-coach text-body leading-relaxed text-ink-2">
          Sarthi is a personal life coach for Health, Money, Habits, and Skills. This stub explains, in
          plain terms, what we store and why. It will be expanded before general availability.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">What we store</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            The entries you capture — meals, spends, habits, study sessions, and reflections — plus your
            profile and preferences. Everything is scoped to your account; we do not read one person&rsquo;s
            data into another&rsquo;s.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">How it is used</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            Your data powers your own briefs, reflections, and plan adaptations. We do not sell it or use
            it to train third-party models.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">Service providers</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            Authentication and storage run on Supabase. Payments, when enabled, run on Razorpay. Voice,
            photo, and text understanding are processed by the configured AI provider only to produce your
            results. If you join the waitlist, we keep your email to contact you about access.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">Your choices</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            Every write in Sarthi is undoable. To export or delete your data, contact us and we will action
            it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">Contact</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            Questions about privacy? Email{" "}
            <a href="mailto:hello@sarthi.app" className="text-ink-1 underline focus-visible:ring-2 focus-visible:ring-ring">
              hello@sarthi.app
            </a>
            .
          </p>
        </section>

        <nav aria-label="Legal" className="mt-4 flex items-center gap-4 font-ui text-caption text-ink-3">
          <Link href="/terms" className="underline focus-visible:ring-2 focus-visible:ring-ring">
            Terms
          </Link>
          <Link href="/" className="underline focus-visible:ring-2 focus-visible:ring-ring">
            Home
          </Link>
        </nav>
      </article>
    </main>
  );
}
