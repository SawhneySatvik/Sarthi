"use client";

import Link from "next/link";
import { useState } from "react";

import { ArtFrame } from "@/components/art/ArtFrame";
import { Wordmark } from "@/components/landing/Wordmark";
import { Button } from "@/components/ui/Button";

type Status = "idle" | "submitting" | "added" | "already" | "error";

const DONE_COPY: Record<"added" | "already", { title: string; body: string }> = {
  added: {
    title: "You're on the list.",
    body: "We'll email you when early access opens.",
  },
  already: {
    title: "You're already on the list.",
    body: "Sit tight — we'll be in touch when early access opens.",
  },
};

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const submitting = status === "submitting";
  const done = status === "added" || status === "already";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data: { ok?: boolean; status?: string; error?: string } = await response.json();
      if (data.ok) {
        setStatus(data.status === "already" ? "already" : "added");
        return;
      }
      setError(data.error ?? "Something went wrong. Please try again.");
      setStatus("error");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-dvh bg-canvas lg:grid lg:grid-cols-2">
      {/* Left — a dusk art panel (lg+). Depth is the painterly scene; the ArtFrame's own
          scrim keeps the on-art wordmark + line legible. */}
      <aside className="relative isolate hidden overflow-hidden lg:block">
        <div className="absolute inset-0 -z-10">
          <ArtFrame artKey="today.header.dusk" eager ratio="h-full w-full rounded-none border-0" />
        </div>
        <div className="flex h-full flex-col justify-between p-10">
          <Link href="/" className="w-fit rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Wordmark className="on-art" />
          </Link>
          <p className="max-w-sm font-coach text-display on-art">
            One sentence. Your whole life, sorted.
          </p>
        </div>
      </aside>

      {/* Mobile art band (hidden on lg, where the side panel shows instead) — gives the
          phone view the same painterly atmosphere + wordmark instead of a bare void. */}
      <div className="relative isolate h-52 overflow-hidden lg:hidden">
        <div className="absolute inset-0 -z-10">
          <ArtFrame artKey="today.header.dusk" eager ratio="h-full w-full rounded-none border-0" />
        </div>
        <div className="flex h-full flex-col justify-between p-6">
          <Link href="/" className="w-fit rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Wordmark className="on-art" />
          </Link>
          <p className="max-w-xs font-coach text-title on-art">One sentence. Your whole life, sorted.</p>
        </div>
      </div>

      {/* The form — natural flow on mobile (no forced full-height void), centered on lg. */}
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-10 lg:min-h-dvh">
        <div className="w-full max-w-md">
          <p className="font-ui text-caption font-medium uppercase tracking-[0.14em] text-ink-3">Sarthi Pro</p>
          <h1 className="mt-3 font-coach text-display-xl text-ink-1">Join the waitlist</h1>
          <p className="mt-3 font-ui text-body leading-relaxed text-ink-2">
            Early access to managed AI — we run parse, photo, and coach for you. No key to manage.
          </p>

          {done ? (
            <div className="mt-8 rounded-card border border-line bg-raised p-6" role="status" aria-live="polite">
              <p className="font-coach text-title text-ink-1">{DONE_COPY[status as "added" | "already"].title}</p>
              <p className="mt-2 font-ui text-body text-ink-2">
                {DONE_COPY[status as "added" | "already"].body}
              </p>
            </div>
          ) : (
            <form className="mt-8 flex flex-col gap-3" onSubmit={onSubmit} noValidate>
              <label htmlFor="waitlist-email" className="font-ui text-caption text-ink-2">
                Email
              </label>
              <input
                id="waitlist-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (status === "error") setStatus("idle");
                }}
                placeholder="you@example.com"
                disabled={submitting}
                aria-invalid={status === "error"}
                className="min-h-11 w-full rounded-input border border-line bg-raised px-3 font-ui text-body text-ink-1 placeholder:text-ink-3 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
              {status === "error" && error ? (
                <p className="font-ui text-caption text-ink-2" role="alert" aria-live="assertive">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || email.trim().length === 0}
                className="mt-1 min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring"
              >
                {submitting ? "Joining…" : "Join the waitlist"}
              </Button>
            </form>
          )}

          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center font-ui text-caption text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
