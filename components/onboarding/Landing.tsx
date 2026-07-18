"use client";

import { Button } from "@/components/ui/Button";

/*
 * Phase G — Landing (§9). The thin bridge into Today, Day 1. The plan spine is already
 * written (D-accept), the coach's first line and the one-time mic hint render on Today itself
 * (wired there). This just crossfades and hands off — `Enter` calls `router.replace('/today')`
 * in the parent. Neutral CTA (the earned amber was spent on the D "start Day 1" tap).
 */
export function Landing({ name, onEnter }: { name: string | null; onEnter: () => void }) {
  return (
    <div className="flex flex-1 flex-col pb-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-display-xl text-ink-1">You&rsquo;re all set{name ? `, ${name}` : ""}.</h1>
        <p className="mt-3 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
          Day 1 starts now. Just say your day.
        </p>
      </div>

      <Button className="w-full" onClick={onEnter}>
        Enter Today
      </Button>
    </div>
  );
}
