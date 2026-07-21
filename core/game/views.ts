import { formatPaise, type MoneyView } from "@/core/domains/money";
import { formatMasteryShort, type SkillsView } from "@/core/domains/skills";
import type { CoachNoteRecord, DayOneSnapshotRecord, DomainProgressRecord, EvidenceRecord, PlanArcRecord, PlanItemRecord, SkillRecord, SkillSessionRecord } from "@/data/schema/contract";

export type DisplayDomain = "health" | "money" | "habits" | "skills";
export interface StatsCardView { domain: DisplayDomain; headline: string; detail: string; level: number; sparklineText: string; dayOne: string | null; }
export interface StatsView { overall: { level: number; xp: number; day: number; streak: number }; cards: readonly StatsCardView[]; potentialAvailable: false; }
function progress(rows: readonly DomainProgressRecord[], domain: DomainProgressRecord["domain"]) { return rows.find((row) => row.domain === domain) ?? null; }
function snapshot(rows: readonly DayOneSnapshotRecord[], domain: DisplayDomain) { return rows.find((row) => row.domain === domain) ?? null; }

/** Typed projections only: absent progress is a Day-1 level one, never a fabricated level zero. */
export function buildStatsView(input: { progress: readonly DomainProgressRecord[]; snapshots: readonly DayOneSnapshotRecord[]; arc: PlanArcRecord | null; money: MoneyView; skills: SkillsView; healthAdherenceBps: number; habitsBestStreak: number }): StatsView {
  const overall = progress(input.progress, "overall"); const health = progress(input.progress, "health"); const money = progress(input.progress, "money"); const habits = progress(input.progress, "habits"); const skills = progress(input.progress, "skills");
  const mastery = input.skills.skills[0]?.masteryMinutes ?? 0;
  const card = (domain: DisplayDomain, headline: string, detail: string, row: DomainProgressRecord | null, sparklineText: string): StatsCardView => {
    const initial = snapshot(input.snapshots, domain);
    return { domain, headline, detail, level: row?.level ?? 1, sparklineText, dayOne: initial ? `L${initial.statsJson.level} · ${initial.statsJson.xp} XP → L${row?.level ?? 1} · ${row?.xp ?? 0} XP` : null };
  };
  return { overall: { level: overall?.level ?? 1, xp: overall?.xp ?? 0, day: input.arc?.dayNumber ?? 1, streak: overall?.bestStreak ?? 0 }, potentialAvailable: false, cards: [
    card("health", `${Math.floor(input.healthAdherenceBps / 100)}%`, "plan adherence", health, "Health: adherence from typed plan items"),
    card("money", formatPaise(input.money.safeToSpend.valuePaise), "safe to spend", money, "Money: live safe-to-spend from typed ledger"),
    card("habits", `${input.habitsBestStreak} days`, "best streak", habits, "Habits: best typed streak"),
    card("skills", formatMasteryShort(mastery), "mastery", skills, "Skills: cumulative typed session minutes"),
  ] };
}

export interface JourneyEvidence { id: string; domain: DisplayDomain; caption: string; entryKind: string; localDate: string; occurredAt: string; missingImage: boolean; }
export interface JourneyMilestone { id: string; localDate: string; kind: "level" | "arc" | "mastery" | "streak"; label: string; }
export interface JourneyDay { localDate: string; month: string; evidence: readonly JourneyEvidence[]; note: string | null; milestones: readonly JourneyMilestone[]; taskProgress: { done: number; total: number } | null; }
export interface JourneyView { days: readonly JourneyDay[]; milestones: readonly JourneyMilestone[]; }
function skillMinutes(skills: readonly SkillRecord[], sessions: readonly SkillSessionRecord[]): Map<string, number> { const result = new Map(skills.map((skill) => [skill.id, 0])); for (const session of sessions) result.set(session.skillId, (result.get(session.skillId) ?? 0) + session.minutes); return result; }

/** Deterministic, de-duplicated milestones from existing typed rows; no timeline persistence. */
export function buildJourneyView(input: { evidence: readonly EvidenceRecord[]; notes: readonly CoachNoteRecord[]; progress?: readonly DomainProgressRecord[]; arcs?: readonly PlanArcRecord[]; skills?: readonly SkillRecord[]; sessions?: readonly SkillSessionRecord[]; planItems?: readonly PlanItemRecord[] }): JourneyView {
  const notes = new Map<string, string>();
  for (const note of input.notes.slice().sort((a, b) => a.localDate.localeCompare(b.localDate) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))) {
    if (!notes.has(note.localDate)) notes.set(note.localDate, note.text);
  }
  const groups = new Map<string, JourneyEvidence[]>(); const evidenceIds = new Set<string>();
  for (const row of input.evidence.slice().sort((a, b) => a.id.localeCompare(b.id) || b.updatedAt.localeCompare(a.updatedAt))) {
    if (row.domain === "overall") continue;
    if (evidenceIds.has(row.id)) continue;
    evidenceIds.add(row.id);
    const list = groups.get(row.localDate) ?? [];
    list.push({ id: row.id, domain: row.domain, caption: row.caption ?? `${row.entryKind} evidence`, entryKind: row.entryKind, localDate: row.localDate, occurredAt: row.occurredAt, missingImage: row.storagePath.length === 0 || row.storageProvider === "placeholder" });
    groups.set(row.localDate, list);
  }
  const milestones: JourneyMilestone[] = [];
  for (const row of input.progress ?? []) { if (row.level > 1 && row.lastActiveDate) milestones.push({ id: `level:${row.domain}:${row.level}`, localDate: row.lastActiveDate, kind: "level", label: `Level ${row.level} · ${row.domain}` }); for (const threshold of [7, 30]) if (row.bestStreak >= threshold && row.lastActiveDate) milestones.push({ id: `streak:${row.domain}:${threshold}`, localDate: row.lastActiveDate, kind: "streak", label: `${threshold}-day streak · ${row.domain}` }); }
  for (const arc of input.arcs ?? []) if (arc.status === "complete" && arc.endDate) milestones.push({ id: `arc:${arc.id}`, localDate: arc.endDate, kind: "arc", label: `${arc.title} complete` });
  const minutes = skillMinutes(input.skills ?? [], input.sessions ?? []); for (const skill of input.skills ?? []) for (const threshold of [600, 6000, 30000]) if ((minutes.get(skill.id) ?? 0) >= threshold) milestones.push({ id: `mastery:${skill.id}:${threshold}`, localDate: (input.sessions ?? []).filter((session) => session.skillId === skill.id).sort((a, b) => b.localDate.localeCompare(a.localDate))[0]?.localDate ?? "", kind: "mastery", label: `${threshold / 60}h · ${skill.name}` });
  const milestoneIds = new Set<string>();
  const unique = milestones.filter((row) => row.localDate.length > 0).sort((a, b) => a.id.localeCompare(b.id) || b.localDate.localeCompare(a.localDate) || a.label.localeCompare(b.label)).filter((row) => {
    if (milestoneIds.has(row.id)) return false;
    milestoneIds.add(row.id);
    return true;
  }).sort((a, b) => b.localDate.localeCompare(a.localDate) || a.id.localeCompare(b.id));
  const taskProgress = new Map<string, { done: number; total: number }>();
  for (const item of input.planItems ?? []) {
    const current = taskProgress.get(item.localDate) ?? { done: 0, total: 0 };
    current.total += 1;
    if (item.status === "done") current.done += 1;
    taskProgress.set(item.localDate, current);
  }
  const dates = new Set([...groups.keys(), ...notes.keys(), ...unique.map((row) => row.localDate), ...taskProgress.keys()]);
  return { milestones: unique, days: [...dates].sort((a, b) => b.localeCompare(a)).map((localDate) => ({ localDate, month: localDate.slice(0, 7), evidence: (groups.get(localDate) ?? []).slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id)), note: notes.get(localDate) ?? null, milestones: unique.filter((row) => row.localDate === localDate), taskProgress: taskProgress.get(localDate) ?? null })) };
}
