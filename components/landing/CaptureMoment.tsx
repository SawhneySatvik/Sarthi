import { Check, ChevronRight, Mic, Zap } from "lucide-react";

import { StatPill } from "@/components/ui/StatPill";

import { Reveal, Stagger, StaggerItem } from "./Reveal";

/*
 * The magic moment — the moat, made legible. One spoken line routes into typed entries
 * across four domains at once. It encodes invariant #1 visually: explicit values FILE
 * silently (flat, ink-2, check) while the lone estimate surfaces as a raised CONFIRM card
 * (bg-raised, ink-1, chevron) — the auto-filed vs pending states are unmistakably different
 * (DESIGN §1.5). Rows are hairline-divided inside ONE card (no card-of-cards, DESIGN §11).
 * The page's single amber +XP beat now lives in the hero LiveCaptureDemo (the animated,
 * memorable one), so this section's XP reference is deliberately muted (tone="muted") —
 * amber-discipline holds at exactly one earned beat page-wide (invariant #4).
 */

type Entry = {
  domain: string;
  tick: string;
  title: string;
  /** The free-text detail (spoken words) — the only part that may truncate at 390. */
  note?: string;
  value: string;
  status: "filed" | "confirm";
};

/* The trust marker IS the section's argument, so it must always survive layout: it is
 * derived from status (explicit values file; estimates confirm), never truncated. */
const MARKER: Record<Entry["status"], string> = { filed: "explicit", confirm: "estimated" };

const ENTRIES: readonly Entry[] = [
  { domain: "Money", tick: "bg-money", title: "Lunch", value: "−₹340", status: "filed" },
  { domain: "Health", tick: "bg-health", title: "Meal", note: "2 rotis, dal", value: "~520 kcal", status: "confirm" },
  { domain: "Health", tick: "bg-health", title: "Water", note: "one bottle", value: "500 ml", status: "filed" },
  { domain: "Skills", tick: "bg-skills", title: "System design", value: "90 min", status: "filed" },
  { domain: "Habits", tick: "bg-habits", title: "Woke", value: "5:10 AM", status: "filed" },
];

function StatusBadge({ status }: { status: Entry["status"] }) {
  if (status === "filed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-chip border border-line px-2.5 py-1 font-ui text-caption text-ink-2">
        <Check size={13} aria-hidden />
        Filed
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-chip border border-line bg-raised px-2.5 py-1 font-ui text-caption text-ink-1">
      Confirm
      <ChevronRight size={13} aria-hidden />
    </span>
  );
}

export function CaptureMoment() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
      <Reveal className="flex flex-col gap-3">
        <p className="font-ui text-caption uppercase tracking-[0.22em] text-ink-2">The one-shot capture</p>
        <h2 className="max-w-2xl font-display text-display tracking-tight text-ink-1">
          One sentence. Four domains. At once.
        </h2>
        <p className="max-w-xl font-ui text-body text-ink-2">
          Sarthi hears the whole day in one line and routes each fact to its own typed store —
          no four apps, no forms.
        </p>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-10">
        <Reveal className="lg:sticky lg:top-24">
          <div className="rounded-card border border-line bg-card p-6 shadow-[var(--elev-card)]">
            <div className="flex items-center gap-2 font-ui text-caption uppercase tracking-[0.18em] text-ink-3">
              <Mic size={14} aria-hidden />
              You said
            </div>
            <p className="mt-4 font-ui text-title italic leading-snug text-ink-1">
              &ldquo;Spent ₹340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system
              design, woke at 5:10.&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-2 font-ui text-caption text-ink-3">
              <span className="h-px w-8 bg-line" aria-hidden />
              parses into
              <ChevronRight size={13} aria-hidden />
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col gap-6">
          <Stagger className="rounded-card border border-line bg-card px-6 shadow-[var(--elev-card)]">
            {ENTRIES.map((entry, i) => (
              <StaggerItem
                key={`${entry.domain}-${entry.title}`}
                className={`flex items-start gap-3 py-4 ${i === 0 ? "" : "border-t border-line"}`}
              >
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-chip ${entry.tick}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <p className="min-w-0 flex-1 truncate font-ui text-body text-ink-1">{entry.title}</p>
                    <span className="shrink-0 font-display text-body tabular-nums text-ink-2">{entry.value}</span>
                  </div>
                  <p className="mt-0.5 flex items-baseline gap-1.5 font-ui text-caption text-ink-3">
                    <span className="shrink-0">{entry.domain}</span>
                    {entry.note && (
                      <span className="min-w-0 truncate">· {entry.note}</span>
                    )}
                    <span className="shrink-0">· {MARKER[entry.status]}</span>
                  </p>
                </div>
                <StatusBadge status={entry.status} />
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-card px-6 py-4 shadow-[var(--elev-card)]">
            <p className="font-ui text-caption text-ink-2">
              Swipe to confirm the one estimate — that&rsquo;s the only thing that writes
              unconfirmed.
            </p>
            <span className="inline-flex items-center gap-2 font-ui text-caption text-ink-3">
              earned on accept
              <StatPill icon={<Zap size={13} aria-hidden />} tone="muted">
                +18 XP
              </StatPill>
            </span>
          </Reveal>
        </div>
      </div>

      <Stagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StaggerItem className="flex items-start gap-3 rounded-card border border-line bg-card p-5 shadow-[var(--elev-card)]">
          <Check size={18} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
          <p className="font-ui text-body text-ink-2">
            <span className="text-ink-1">Explicit values file silently.</span> What you state
            plainly is written the moment you finish speaking.
          </p>
        </StaggerItem>
        <StaggerItem className="flex items-start gap-3 rounded-card border border-line bg-card p-5 shadow-[var(--elev-card)]">
          <ChevronRight size={18} className="mt-0.5 shrink-0 text-ink-1" aria-hidden />
          <p className="font-ui text-body text-ink-2">
            <span className="text-ink-1">Estimates surface as swipe cards.</span> Nothing
            estimated is ever written until you confirm it.
          </p>
        </StaggerItem>
      </Stagger>
    </section>
  );
}
