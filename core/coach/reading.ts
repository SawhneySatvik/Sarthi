import type { AdaptationRecord, CoachMessageRecord, CoachMessageRole, CoachNoteRecord, Domain, EvidenceRecord, ProfileGapRecord } from "@/data/schema/contract";

export interface CoachAdaptationView {
  id: string;
  label: string;
  before: string;
  after: string;
  reason: string;
  status: AdaptationRecord["status"];
}

export interface CoachReadingView {
  daily: CoachNoteRecord | null;
  weekly: CoachNoteRecord | null;
  history: readonly CoachNoteRecord[];
  openGap: ProfileGapRecord | null;
  adaptations: readonly CoachAdaptationView[];
  evidenceCount: number;
  weeklyDomainLines: readonly { domain: Exclude<Domain, "overall">; count: number; text: string }[];
  /** COACH-4 — the server-loaded conversation thread (last-30, chronological, page-safe). */
  thread: readonly CoachThreadMessage[];
}

/**
 * COACH-4 — a page-safe projection of ONE pending inferred-memory proposal (§2.4). The
 * coach's confidence-gated distillation (COACH-7) emits `estimated:true` memory items that
 * must NOT persist silently (invariant #1); they surface as accept/discard cards reusing the
 * capture estimate-card grammar. The live card DATA lands with COACH-7 — the C4 surface just
 * renders it (and renders nothing when the list is empty). No provider/audit internals leak.
 */
export interface CoachMemoryProposalView {
  id: string;
  domain: Exclude<Domain, "overall"> | "global";
  kind: string;
  text: string;
  confidencePct: number;
}

/**
 * COACH-2 — a page-safe projection of one persisted conversation turn. The raw
 * `coach_messages` row also carries the grounded `toolLogJson` + provider/model that
 * authored it; those stay server-side. The thread the client renders needs only the
 * turn text, its role, when it landed, and the (nullable) proposed-adaptation id the
 * inline chip resolves against (COACH-3/COACH-4). No provider/model/tool internals leak.
 */
export interface CoachThreadMessage {
  id: string;
  role: CoachMessageRole;
  text: string;
  localDate: string;
  createdAt: string;
  proposedAdaptationId: string | null;
}

function toThreadMessage(message: CoachMessageRecord): CoachThreadMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    localDate: message.localDate,
    createdAt: message.createdAt,
    proposedAdaptationId: message.proposedAdaptationId,
  };
}

/** The single most-recent turn, page-safe (used for the ask-box response `message`). */
export function projectCoachMessage(message: CoachMessageRecord): CoachThreadMessage {
  return toThreadMessage(message);
}

/** The last `limit` turns in chronological order, page-safe (the `/coach` thread). */
export function projectCoachThread(messages: readonly CoachMessageRecord[], limit = 30): CoachThreadMessage[] {
  return messages
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-limit)
    .map(toThreadMessage);
}

export function formatAdaptationSnapshot(snapshot: AdaptationRecord["beforeJson"]): string {
  const columns = snapshot.columns;
  const title = typeof columns.title === "string" ? columns.title : "Plan item";
  const target = columns.targetValue;
  const unit = typeof columns.targetUnit === "string" && columns.targetUnit ? ` ${columns.targetUnit}` : "";
  return typeof target === "number" ? `${title} · ${target}${unit}` : `${title} · no numeric target`;
}

function isSundayEvening(localTime: { weekday: number; hour: number }): boolean {
  return localTime.weekday === 0 && localTime.hour >= 19;
}

export function summarizeWeeklyEvidence(note: CoachNoteRecord | null): Pick<CoachReadingView, "evidenceCount" | "weeklyDomainLines"> {
  const evidence = note?.evidenceJson.items.filter((item) => item.domain !== "overall") ?? [];
  return {
    evidenceCount: evidence.length,
    weeklyDomainLines: (["health", "money", "habits", "skills"] as const).map((domain) => {
      const count = evidence.filter((item) => item.domain === domain).length;
      return { domain, count, text: `${domain[0].toUpperCase()}${domain.slice(1)}: ${count} typed ${count === 1 ? "entry" : "entries"}` };
    }),
  };
}

/** A page-safe, deterministic projection. A proposed row stays pending until Keep commits it. */
export function buildCoachReadingView(input: {
  localDate: string;
  localTime?: { weekday: number; hour: number };
  notes: readonly CoachNoteRecord[];
  gaps: readonly ProfileGapRecord[];
  adaptations: readonly AdaptationRecord[];
  evidence: readonly EvidenceRecord[];
  /** COACH-4 — the raw `coach_messages` rows; projected to the last-30 page-safe thread. */
  messages?: readonly CoachMessageRecord[];
}): CoachReadingView {
  const ordered = input.notes.slice().sort((a, b) => b.localDate.localeCompare(a.localDate) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const daily = ordered.find((note) => note.scope === "daily" && note.localDate === input.localDate) ?? null;
  const weekly = input.localTime && isSundayEvening(input.localTime)
    ? ordered.find((note) => note.scope === "weekly" && note.localDate === input.localDate) ?? null
    : null;
  const weeklyEvidence = summarizeWeeklyEvidence(weekly);
  return {
    daily,
    weekly,
    history: ordered.filter((note) => note.id !== daily?.id && note.id !== weekly?.id),
    openGap: input.gaps.filter((gap) => gap.status === "open").sort((a, b) => a.gapKey.localeCompare(b.gapKey) || a.id.localeCompare(b.id))[0] ?? null,
    adaptations: input.adaptations.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).map((row) => ({
      id: row.id,
      label: `${formatAdaptationSnapshot(row.beforeJson)} → ${formatAdaptationSnapshot(row.afterJson)}`,
      before: formatAdaptationSnapshot(row.beforeJson), after: formatAdaptationSnapshot(row.afterJson), reason: row.reason, status: row.status,
    })),
    thread: projectCoachThread(input.messages ?? []),
    ...weeklyEvidence,
  };
}
