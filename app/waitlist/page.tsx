"use client";

import Link from "next/link";
import { useState } from "react";

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
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-16">
      <div className="w-full max-w-md rounded-card border border-line bg-raised p-8">
        <p className="font-ui text-caption uppercase tracking-wide text-ink-3">Sarthi Pro</p>
        <h1 className="mt-2 font-display text-title text-ink-1">Join the waitlist</h1>
        <p className="mt-3 font-ui text-body text-ink-2">
          Early access — we run the AI for you.
        </p>

        {done ? (
          <div className="mt-8" role="status" aria-live="polite">
            <p className="font-display text-body text-ink-1">{DONE_COPY[status as "added" | "already"].title}</p>
            <p className="mt-1 font-ui text-caption text-ink-2">
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
              className="min-h-11 w-full rounded-input border border-line bg-canvas px-3 font-ui text-body text-ink-1 placeholder:text-ink-3 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
    </main>
  );
}
