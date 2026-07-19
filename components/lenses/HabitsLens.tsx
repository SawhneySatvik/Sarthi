"use client";

import { Flame, Zap } from "lucide-react";
import { Fragment, useRef, useState, useTransition } from "react";

import { setHabitCompletion } from "@/app/(app)/today/actions";
import { cn } from "@/app/lib/utils";
import { ArtFrame } from "@/components/art/ArtFrame";
import type { HabitRow, HabitsView, HeatmapDay } from "@/core/domains/habits";

/*
 * The Habits lens (SAR-009, D-A/D-E/D-F): a grace-aware streak grid over the pure
 * `HabitsView`. Row grammar is LITERALLY the Health row (shared P3a criterion): the
 * same `<li>` classes and three slots — indigo tick · name · meta. The boundary
 * invariant lives here in the UI and again in the server action:
 *   • rule-free  → a real tickable circle (optimistic manual complete/undo);
 *   • rule-bearing (satisfied-by) → NO tick; tap = one wiggle + rule hint, long-press =
 *     sticky hint; `aria-describedby` gives the same explanation without a gesture.
 * Tokens only — indigo `--dom-habits`; amber (`--energy`) appears ONLY on an earned
 * streak number (D-041). The heatmap surfaces grace days as hollow rings.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Auto-dismiss for a tapped (transient) hint — mirrors one `--t-hero` beat (900ms). */
const HINT_DISMISS_MS = 900;
/** Pointer-hold that promotes a tap into a sticky hint (glass-box "why" parity). */
const LONG_PRESS_MS = 500;

const DOMAIN_LABEL: Record<string, string> = {
  overall: "Overall",
  health: "Health",
  money: "Money",
  habits: "Habits",
  skills: "Skills",
};

function groupInt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function niceDate(localDate: string): string {
  const [, month, day] = localDate.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

/** Flame + streak number. Amber ONLY when the streak is earned (> 0); else muted (D-041). */
function HabitFlame({ streak }: { streak: number }) {
  const earned = streak > 0;
  return (
    <span
      className={cn("flex items-center gap-1 tabular-nums", earned ? "text-energy" : "text-ink-3")}
      aria-label={`${streak} day streak`}
    >
      <Flame size={13} strokeWidth={1.5} aria-hidden />
      <span className="font-ui text-caption">{streak}</span>
    </span>
  );
}

/** Rule-free row: the meta slot's tickable circle — optimistic, reverts on failure (D-A). */
function TickRow({ row }: { row: HabitRow }) {
  const serverFilled = row.today === "done" || row.today === "partial";
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const filled = optimistic ?? serverFilled;

  function toggle() {
    const next = filled ? "clear" : "done";
    setOptimistic(!filled); // optimistic flip
    startTransition(async () => {
      try {
        await setHabitCompletion(row.habitId, next);
        setOptimistic(null); // adopt the revalidated server truth
      } catch {
        setOptimistic(null); // revert to the server-derived state
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-card bg-card px-4 py-3">
      <span className="h-2 w-2 shrink-0 rounded-chip bg-habits" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-ui text-body text-ink-1">{row.name}</span>
      <span className="flex shrink-0 items-center gap-3">
        <HabitFlame streak={row.streak} />
        <button
          type="button"
          aria-pressed={filled}
          aria-label={filled ? `Mark ${row.name} not done` : `Mark ${row.name} done`}
          disabled={pending}
          onClick={toggle}
          className="grid h-11 w-11 place-items-center disabled:opacity-60"
        >
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-chip border font-ui text-caption",
              filled ? "border-habits bg-habits text-canvas" : "border-line text-ink-3",
            )}
          >
            {filled ? "✓" : ""}
          </span>
        </button>
      </span>
    </li>
  );
}

/** Satisfied-by meta slot: the ⚡ auto badge + live integer progress (never a tick). */
function SatisfiedBadge({ row }: { row: HabitRow }) {
  const sb = row.satisfiedBy!;
  const done = row.source === "satisfied-by";
  const label = DOMAIN_LABEL[sb.sourceDomain] ?? sb.sourceDomain;
  const unit = sb.targetUnit ? ` ${sb.targetUnit}` : "";
  const metric =
    sb.todayTotal !== null && sb.targetValue !== null
      ? `${groupInt(sb.todayTotal)} / ${groupInt(sb.targetValue)}${unit}`
      : sb.todayTotal !== null
        ? `${groupInt(sb.todayTotal)}${unit}`
        : null;
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 font-ui text-caption text-ink-2"
      aria-label={`Auto from ${label}${metric ? `, ${metric}` : ""}${done ? ", satisfied" : ""}`}
    >
      <span aria-hidden className={done ? "text-habits" : "text-ink-3"}>
        <Zap size={14} strokeWidth={1.5} aria-hidden />
      </span>
      {metric && <span className="tabular-nums">{metric}</span>}
      {done && (
        <span aria-hidden className="text-habits">
          ✓
        </span>
      )}
    </span>
  );
}

/** Reduced-motion guard: the `animate-refuse` keyframes never run (and `onAnimationEnd`
 *  never fires) when the user opts out, so we must not latch `wiggle` true. */
function motionAllowed(): boolean {
  return typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Rule-bearing row: refuses manual ticks — tap wiggles + reveals the rule hint. */
function RefuseRow({ row }: { row: HabitRow }) {
  const [open, setOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const hintId = `habit-hint-${row.habitId}`;

  function clearTimers() {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = null;
  }

  function tap() {
    if (longPressedRef.current) {
      longPressedRef.current = false; // long-press already opened the sticky hint
      return;
    }
    if (open && sticky) {
      setOpen(false); // a tap dismisses a sticky hint
      setSticky(false);
      return;
    }
    // Transient reveal + one wiggle cycle, auto-dismissed after ~one --t-hero beat.
    setSticky(false);
    setOpen(true);
    if (motionAllowed()) setWiggle(true); // else no animation → onAnimationEnd never fires → don't latch
    if (dismissRef.current) clearTimeout(dismissRef.current);
    dismissRef.current = setTimeout(() => setOpen(false), HINT_DISMISS_MS);
  }

  function onPointerDown() {
    longPressedRef.current = false;
    clearTimers();
    longPressRef.current = setTimeout(() => {
      longPressedRef.current = true;
      setSticky(true);
      setOpen(true); // sticky until tapped away — no auto-dismiss
      if (dismissRef.current) clearTimeout(dismissRef.current);
    }, LONG_PRESS_MS);
  }

  return (
    <>
      <li
        role="button"
        tabIndex={0}
        aria-describedby={hintId}
        onClick={tap}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            tap();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerUp={clearTimers}
        onPointerLeave={clearTimers}
        onAnimationEnd={() => setWiggle(false)}
        className={cn(
          "flex items-center gap-3 rounded-card bg-card px-4 py-3",
          wiggle && "animate-refuse",
        )}
      >
        <span className="h-2 w-2 shrink-0 rounded-chip bg-habits" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-ui text-body text-ink-1">{row.name}</span>
        <span className="flex shrink-0 items-center gap-3">
          <HabitFlame streak={row.streak} />
          <SatisfiedBadge row={row} />
        </span>
      </li>
      <li id={hintId} className={cn("px-4", open ? "block pt-0.5" : "sr-only")}>
        <p className="font-ui text-caption text-ink-3">{row.satisfiedBy!.hint}</p>
      </li>
    </>
  );
}

function HeatCell({ day, today }: { day: HeatmapDay; today: string }) {
  const future = day.localDate > today;
  const label = day.grace
    ? `${niceDate(day.localDate)} — grace day, streak protected`
    : `${niceDate(day.localDate)} — ${day.doneCount} of ${day.total} done`;
  if (day.grace) {
    return <span role="img" aria-label={label} className="h-4 w-4 rounded-chip border border-habits" />;
  }
  return (
    <span
      role="img"
      aria-label={label}
      className="h-4 w-4 rounded-chip bg-habits"
      style={{ opacity: future ? 0.12 : Math.max(day.fraction, 0.14) }}
    />
  );
}

function Heatmap({ view }: { view: HabitsView }) {
  return (
    <section className="mt-6">
      <h3 className="px-1 font-ui text-caption uppercase tracking-wide text-ink-3">This month</h3>
      <div className="mt-2 flex flex-col gap-1">
        {view.heatmap.weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) =>
              day ? (
                <HeatCell key={day.localDate} day={day} today={view.localDate} />
              ) : (
                <span key={`pad-${wi}-${di}`} className="h-4 w-4" aria-hidden />
              ),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function HabitsLens({ view }: { view: HabitsView }) {
  return (
    <div className="px-4 pb-2">
      <ArtFrame artKey="habit.journal" ratio="h-20" className="mb-3"><p className="flex h-full items-end p-3 font-display text-title text-ink-1">Habits</p></ArtFrame>
      <header className="pt-1">
        <p className="font-ui text-caption uppercase tracking-wide text-habits">Habits</p>
        <p className="font-display text-display-xl tabular-nums text-ink-1">
          {view.headline.done}
          <span className="text-ink-3"> of {view.headline.total}</span>
        </p>
        <p className="font-ui text-caption text-ink-3">done today</p>
      </header>

      {view.rows.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1">
          {view.rows.map((row) => (
            <Fragment key={row.habitId}>
              {row.satisfiedBy ? <RefuseRow row={row} /> : <TickRow row={row} />}
            </Fragment>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-center font-ui text-body text-ink-3">No habits yet — add one to start a streak.</p>
      )}

      <Heatmap view={view} />
    </div>
  );
}
