"use client";

import { Check, ChevronLeft, Circle, CircleDot } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/app/lib/utils";
import { ArtFrame } from "@/components/art/ArtFrame";
import type { MilestoneRow, SessionRow, SkillTrack, SkillsView } from "@/core/domains/skills";
import { formatMasteryShort } from "@/core/domains/skills";

/*
 * The Skills lens (SAR-010, D-A..D-D): a read-only mastery/curriculum view over the pure
 * `SkillsView`. List of practice tracks → tap a track to PUSH a drill (lens-local state,
 * like the Money category drill), a `← Skills` chip RETURNS with the list intact — no
 * route change (D-C). The drill's mastery counter is the unmistakable hero: the largest
 * Display element on the screen, `tabular-nums`, `--dom-skills`-tinted, hours derived
 * ÷60 in display only (D-B). Row grammar matches the other lenses (domain-hue dot · title
 * · meta); curriculum glyphs are token-coloured lucide icons (✓/▸/○ — never a raw emoji,
 * the D-041/SAR-009 lesson). Estimated sessions carry the glass-box `~` tilde.
 *
 * Tokens only — violet `--dom-skills`; NO amber (`--energy` is XP/streak/level only, and
 * there is no XP/streak surface in this lens). READ-ONLY: no milestone toggle, no session
 * edit, no new-skill create, no timer — all deferred (writes go through CommitService).
 */

/** A duration in integer minutes → a compact, readable span (display-only). */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const mm = minutes % 60;
  const hh = (minutes - mm) / 60;
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}

/** Target minutes → whole-hour label for the meter (e.g. 30000 → "500h"). */
function targetHoursLabel(targetMinutes: number): string {
  return `${Math.floor(targetMinutes / 60)}h`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="px-1 font-ui text-caption uppercase tracking-wide text-ink-3">{children}</h3>;
}

/** The 10/100/500h tier line under the hero — display-only, derived from the counter. */
function tierCaption(track: SkillTrack): string {
  if (track.thresholdHours > 0) {
    return track.nextThresholdHours !== null
      ? `${track.thresholdHours}h crossed · next ${track.nextThresholdHours}h`
      : `${track.thresholdHours}h+ mastery`;
  }
  return track.nextThresholdHours !== null ? `first tier at ${track.nextThresholdHours}h` : "";
}

function MilestoneGlyph({ state }: { state: MilestoneRow["state"] }) {
  if (state === "done") return <Check size={16} strokeWidth={2} className="text-skills" aria-hidden />;
  if (state === "current") return <CircleDot size={16} strokeWidth={2} className="text-skills" aria-hidden />;
  return <Circle size={16} strokeWidth={1.5} className="text-ink-3" aria-hidden />;
}

function MilestoneItem({ milestone }: { milestone: MilestoneRow }) {
  const label = milestone.state === "done" ? "completed" : milestone.state === "current" ? "in progress" : "upcoming";
  return (
    <li className="flex items-center gap-3 rounded-card bg-card px-4 py-3">
      <span className="shrink-0" aria-label={label}>
        <MilestoneGlyph state={milestone.state} />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-ui text-body",
          milestone.state === "upcoming" ? "text-ink-3" : "text-ink-1",
        )}
      >
        {milestone.label}
      </span>
    </li>
  );
}

function SessionItem({ session }: { session: SessionRow }) {
  return (
    <li className="flex items-center gap-3 rounded-card bg-card px-4 py-3">
      <span className="h-2 w-2 shrink-0 rounded-chip bg-skills" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-ui text-body text-ink-1">{session.note ?? "Practice"}</span>
      <span className="shrink-0 font-ui text-caption tabular-nums text-ink-2">
        {session.estimated ? "~ " : ""}
        {formatDuration(session.minutes)}
      </span>
    </li>
  );
}

/** A single track's summary card in the list — tap PUSHES its drill (D-C). */
function TrackCard({ track, onOpen }: { track: SkillTrack; onOpen: () => void }) {
  const doneCount = track.milestones.filter((m) => m.state === "done").length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-card border border-line bg-card px-4 py-3 text-left"
    >
      <div className="flex items-center gap-3">
        <span className={cn("h-2 w-2 shrink-0 rounded-chip bg-skills", track.dormant && "opacity-50")} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-ui text-body text-ink-1">{track.name}</span>
        <span className="shrink-0 font-display text-body tabular-nums text-skills-strong">
          {formatMasteryShort(track.masteryMinutes)}
          {track.targetMinutes !== null && (
            <span className="font-ui text-ink-3"> / {targetHoursLabel(track.targetMinutes)}</span>
          )}
        </span>
      </div>
      {track.fraction !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-chip bg-line">
          <div
            className={cn("h-full rounded-chip bg-skills", track.dormant && "opacity-50")}
            style={{ width: `${Math.floor(track.fraction * 100)}%` }}
          />
        </div>
      )}
      <p className="mt-1.5 font-ui text-caption text-ink-3">
        {track.dormant && <span>Dormant · </span>}
        {track.milestones.length > 0 ? `${doneCount}/${track.milestones.length} milestones` : "No curriculum yet"}
      </p>
    </button>
  );
}

/** The drill: hero counter · meter · curriculum · session log — all read-only (D-D). */
function DrillView({ track, onBack }: { track: SkillTrack; onBack: () => void }) {
  const percent = track.fraction !== null ? Math.floor(track.fraction * 100) : null;
  const tier = tierCaption(track);
  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={onBack}
        className="mt-2 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-chip px-2 font-ui text-caption text-ink-2"
      >
        <ChevronLeft size={16} aria-hidden /> Skills
      </button>

      <h2 className="mt-2 font-ui text-caption uppercase tracking-wide text-skills">{track.name}</h2>
      <p className="font-display text-display-xl tabular-nums text-skills">{formatMasteryShort(track.masteryMinutes)}</p>
      <p className="font-ui text-caption text-ink-3">hours practiced{tier && ` · ${tier}`}</p>
      <Link href={`/tools?focusSkillId=${encodeURIComponent(track.id)}&focusMinutes=50`} className="mt-3 inline-flex min-h-11 items-center font-ui text-caption text-skills-strong underline decoration-line underline-offset-4">Start 50m focus</Link>

      {track.targetMinutes !== null && track.fraction !== null && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-chip bg-line">
            <div className="h-full rounded-chip bg-skills" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 font-ui text-caption tabular-nums text-ink-3">
            {formatMasteryShort(track.masteryMinutes)} / {targetHoursLabel(track.targetMinutes)} · {percent}%
          </p>
        </div>
      )}

      <section className="mt-6">
        <SectionHeading>Curriculum</SectionHeading>
        {track.milestones.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {track.milestones.map((m) => (
              <MilestoneItem key={m.id} milestone={m} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 px-1 font-ui text-caption text-ink-3">No curriculum yet.</p>
        )}
      </section>

      <section className="mt-6">
        <SectionHeading>Recent sessions</SectionHeading>
        {track.sessions.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {track.sessions.map((s) => (
              <SessionItem key={s.id} session={s} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 px-1 font-ui text-caption text-ink-3">No sessions logged yet.</p>
        )}
      </section>
    </div>
  );
}

export function SkillsLens({ view }: { view: SkillsView }) {
  const [drillSkillId, setDrillSkillId] = useState<string | null>(null);
  const drill = drillSkillId ? view.skills.find((s) => s.id === drillSkillId) ?? null : null;
  if (drill) return <DrillView track={drill} onBack={() => setDrillSkillId(null)} />;

  return (
    <div className="px-4 pb-2">
      <ArtFrame artKey="skills.desk_code" ratio="h-20" className="mb-3"><p className="flex h-full items-end p-3 font-display text-title text-ink-1">Skills</p></ArtFrame>
      <header className="pt-1">
        <p className="font-ui text-caption uppercase tracking-wide text-skills">Skills</p>
        <p className="font-display text-display-xl tabular-nums text-ink-1">
          {view.skills.length}
          <span className="text-ink-3"> {view.skills.length === 1 ? "track" : "tracks"}</span>
        </p>
        <p className="font-ui text-caption text-ink-3">tap a track for its mastery</p>
      </header>

      {view.skills.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {view.skills.map((track) => (
            <TrackCard key={track.id} track={track} onOpen={() => setDrillSkillId(track.id)} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-card border border-line bg-card px-4 py-6 text-center">
          <p className="font-ui text-body text-ink-1">Name anything — I&rsquo;ll build the road.</p>
          <p className="mt-1 font-ui text-caption text-ink-3">Say a skill out loud to start tracking mastery.</p>
        </div>
      )}
    </div>
  );
}
