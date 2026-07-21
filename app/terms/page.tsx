import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms · Sarthi",
  description: "The terms of using Sarthi.",
};

/*
 * app/terms/page.tsx — a minimal, accurate terms stub (PL-2 / legal stubs). Linked from the auth
 * pages and Settings. Public (no auth). Tokens-only, Bone; no new design system.
 */
export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-canvas px-5 py-12 text-ink-1 sm:px-8">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="font-ui text-caption font-medium uppercase tracking-[0.14em] text-ink-3">Sarthi</p>
          <h1 className="font-display text-display text-ink-1">Terms</h1>
          <p className="font-ui text-caption text-ink-3">Last updated 20 July 2026</p>
        </header>

        <p className="font-coach text-body leading-relaxed text-ink-2">
          These stub terms govern your use of Sarthi during early access. By creating an account you agree
          to them. They will be expanded before general availability.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">The service</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            Sarthi helps you track Health, Money, Habits, and Skills and reacts with coaching. It is a
            personal tool, not medical, legal, or financial advice.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">Your account</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            You are responsible for keeping your credentials secure and for the activity under your account.
            Early access is offered selectively and may be limited or revoked.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">Billing</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            A paid plan may be offered. During early access, billing runs in test mode where noted and no
            real charge is made. Any pricing shown may change.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">Acceptable use</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            Do not misuse the service, attempt to access other users&rsquo; data, or use it for unlawful
            purposes.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">No warranty</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            Early access is provided &ldquo;as is,&rdquo; without warranties. To the extent permitted by law,
            we are not liable for indirect or consequential losses arising from your use of Sarthi.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-title text-ink-1">Contact</h2>
          <p className="font-coach text-body leading-relaxed text-ink-2">
            Questions about these terms? Email{" "}
            <a href="mailto:hello@sarthi.app" className="text-ink-1 underline focus-visible:ring-2 focus-visible:ring-ring">
              hello@sarthi.app
            </a>
            .
          </p>
        </section>

        <nav aria-label="Legal" className="mt-4 flex items-center gap-4 font-ui text-caption text-ink-3">
          <Link href="/privacy" className="underline focus-visible:ring-2 focus-visible:ring-ring">
            Privacy
          </Link>
          <Link href="/" className="underline focus-visible:ring-2 focus-visible:ring-ring">
            Home
          </Link>
        </nav>
      </article>
    </main>
  );
}
