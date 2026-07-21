import type { LlmGateway } from "@/core/contracts";
import { deriveGameSummary, deriveReentryCandidate, type GameSummary } from "@/core/game";
import type { CoachMemoryDomain, CoachMemoryRecord } from "@/data/schema/contract";

import { proposeAdaptationRow } from "./adaptation";
import { runCoachAgent, type CoachAgentMemory, type CoachAgentTranscriptMessage } from "./agent";
import { coachBriefOutputSchema, toCoachEvidence, type CoachEngine, type CreateCoachEngineOptions, type DateRange, type DomainCoachContext } from "./contract";
import { bumpMemoryUsage, selectMemories } from "./memory";
import { DOMAIN_REGISTRY } from "./registry";

/** The four locked domains a broad/ambiguous turn fans out to (COACH-2 domain detection). */
const COACH_TURN_DOMAINS: readonly CoachMemoryDomain[] = ["health", "money", "habits", "skills"];

/** Map the persisted Layer-2 memory rows into the agent envelope's memory shape. */
function toAgentMemories(rows: readonly CoachMemoryRecord[]): CoachAgentMemory[] {
  return rows.map((row) => ({ id: row.id, domain: row.domain, kind: row.kind, text: row.text, pinned: row.pinned }));
}

/** Keep only JSON-primitive arg values so the bounded `coachToolLog` shape validates. */
function toLogArgs(args: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null ? value : String(value);
  }
  return out;
}

/**
 * Detect the turn's domain(s) from the question by simple keyword match (COACH-2). The
 * detected set filters Layer-2's top-K NON-pinned rows; `global` is always eligible (added
 * inside `selectMemories`) and ALL pinned rows are returned regardless of domain — so a
 * money goal survives a health-domain turn. Cross-cutting asks (progress / planning) and
 * anything unmatched fan out to all four locked domains.
 */
function detectDomains(text: string): CoachMemoryDomain[] {
  const q = text.toLowerCase();
  const domains = new Set<CoachMemoryDomain>();
  if (/(money|spend|spent|budget|paise|rupee|₹|expense|save|saving|cost|afford)/.test(q)) domains.add("money");
  if (/(health|meal|water|sleep|workout|weight|hydrat|calorie|eat)/.test(q)) domains.add("health");
  if (/(habit|routine|wake|morning|meditat)/.test(q)) domains.add("habits");
  if (/(skill|practice|study|learn|focus|deep work)/.test(q)) domains.add("skills");
  if (/(streak|progress|xp|level|how am i|momentum|inactive|plan|lighter|target|adjust|reduce|heavy|too much|goal)/.test(q)) {
    for (const domain of COACH_TURN_DOMAINS) domains.add(domain);
  }
  if (domains.size === 0) for (const domain of COACH_TURN_DOMAINS) domains.add(domain);
  return [...domains];
}

function fingerprint(scope: "daily" | "weekly", range: DateRange, contexts: readonly DomainCoachContext[], profileGapKey: string | null): string {
  const items = contexts.flatMap((context) => context.evidence).map((item) => [item.domain, item.entryKind, item.entryId ?? "", item.valueInt ?? "", item.unit ?? "", item.label].join("|"));
  return `${scope}:${range.start}:${range.end}:${[...items, profileGapKey ?? ""].sort().join(";")}`;
}

function weekEnd(weekStart: string): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 6));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function createCoachEngine(options: CreateCoachEngineOptions): CoachEngine {
  const { repos, llm, commits } = options;
  const now = options.now ?? (() => new Date().toISOString());

  async function loadSummary(localDate: string): Promise<GameSummary> {
    const [progress, skills, sessions, planItems, evidence, adaptations] = await Promise.all([
      repos.plans.progress.list({}), repos.skills.skills.list({}), repos.skills.sessions.list({}), repos.plans.items.list({}), repos.evidence.list({}), repos.coach.adaptations.list({}),
    ]);
    return deriveGameSummary({ localDate, progress, skills, sessions, planItems, evidence, adaptations });
  }

  async function brief(scope: "daily" | "weekly", range: DateRange, timezone: string) {
    const contexts = await Promise.all(DOMAIN_REGISTRY.map((spec) => spec.contextLoader(repos, range)));
    const openGap = scope === "daily" ? (await repos.profile.gaps.list({})).filter((gap) => gap.status === "open").sort((a, b) => a.gapKey.localeCompare(b.gapKey))[0] ?? null : null;
    const stalenessKey = fingerprint(scope, range, contexts, openGap?.gapKey ?? null);
    const existing = (await repos.coach.notes.list({})).find((note) => note.scope === scope && note.stalenessKey === stalenessKey);
    if (existing) return existing;

    const evidence = toCoachEvidence(range.end, [
      ...contexts.flatMap((context) => context.evidence),
      ...(openGap ? [{ domain: "overall" as const, entryKind: "profileGap", entryId: openGap.id, label: openGap.prompt, valueInt: null, unit: null }] : []),
    ]);
    const result = await llm.generateObject({
      tier: "deep",
      schema: coachBriefOutputSchema,
      system:
        "You are Sarthi, a calm, grounded life coach across Health, Money, Habits, and Skills. Write one concise brief (a few sentences) for the given scope, in a warm, plain, non-preachy voice. Ground every statement ONLY in the supplied typed evidence — reference what actually happened (specific captures, streaks, spend, focus); invent no events, numbers, or clichés. Never claim a plan changed unless a change is visibly proposed in the evidence. If a profile gap is supplied, you may gently invite that one answer. Return only the structured object with the correct scope.",
      prompt: JSON.stringify({ scope, timezone, range, evidence, nextProfileGap: openGap ? { prompt: openGap.prompt, options: openGap.optionsJson } : null }),
      telemetry: { operation: "coach-brief" },
    });
    const output = coachBriefOutputSchema.parse(result.object);
    if (output.scope !== scope) throw new Error("coach provider returned a brief with the wrong scope");
    return repos.coach.notes.create({
      scope,
      localDate: range.end,
      text: output.text,
      modelProvider: result.provider,
      modelId: result.modelId,
      evidenceJson: evidence,
      stalenessKey,
    });
  }

  return {
    async captureLine(input) {
      const planEffects = (await Promise.all(
        DOMAIN_REGISTRY
          .filter((spec) => input.domains.includes(spec.domain))
          .map((spec) => spec.evaluatePlanEffects({ domain: spec.domain, entryKind: "capture", entryId: input.commit.commitId, localDate: "" }, repos)),
      )).flat();
      const line = await llm.generateText({
        tier: "fast",
        system:
          "You are Sarthi. Write ONE short, warm sentence reacting to what the user just logged, grounded strictly in the supplied domains and plan effects. Name the specific thing they captured; be encouraging but calm, never preachy. No advice, no new plans, no invented facts. One sentence only.",
        prompt: JSON.stringify({ commitId: input.commit.commitId, domains: input.domains, planEffects }),
        telemetry: { operation: "capture-line" },
      });
      return line.text;
    },
    dailyBrief(input) {
      return brief("daily", { start: input.localDate, end: input.localDate }, input.timezone);
    },
    weeklyBrief(input) {
      return brief("weekly", { start: input.weekStart, end: weekEnd(input.weekStart) }, input.timezone);
    },
    async converse(input) {
      const text = input.text.trim();
      if (!text) throw new Error("coach question is required");

      const nowIso = now();
      const nowDate = new Date(nowIso);

      // Layer 2 — all pinned + top-K frecency for the turn's detected domain(s).
      const domains = detectDomains(text);
      const { pinned, ranked } = await selectMemories({ repos, domains, now: nowDate });

      // Layer 1 — the last-12 raw turn buffer (chronological), read BEFORE the current
      // user row is appended so the question is never duplicated into its own transcript.
      const buffer = (await repos.coach.messages.list({}))
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .slice(-12);
      const transcript: CoachAgentTranscriptMessage[] = buffer.map((message) => ({ role: message.role, text: message.text }));

      // Persist the user turn (append-only; user rows leave the model columns null).
      await repos.coach.messages.create({
        role: "user",
        text,
        localDate: input.localDate,
        toolLogJson: null,
        proposedAdaptationId: null,
        modelProvider: null,
        modelId: null,
      });

      // CoachAgentResult (C0) does not surface the authoring provider/model and agent.ts is
      // frozen, so a thin gateway wrapper records the last successful generateObject's
      // provider/modelId (both stay null if every attempt failed on the degrade path).
      let modelProvider: string | null = null;
      let modelId: string | null = null;
      const capturing: LlmGateway = {
        async generateObject(request) {
          const result = await llm.generateObject(request);
          modelProvider = result.provider;
          modelId = result.modelId;
          return result;
        },
        generateText: (request) => llm.generateText(request),
      };

      const result = await runCoachAgent({
        repos,
        llm: capturing,
        question: text,
        memories: { pinned: toAgentMemories(pinned), ranked: toAgentMemories(ranked) },
        transcript,
        timezone: input.timezone,
        localDate: input.localDate,
        flightKey: options.userId,
      });

      if (result.status === "busy") {
        // A concurrent turn for this user is still in flight — persist an honest holding
        // reply (a rejection, not a degradation) and touch nothing else.
        const message = await repos.coach.messages.create({
          role: "coach",
          text: result.text,
          localDate: input.localDate,
          toolLogJson: { degraded: false, stepsUsed: 0, entries: [] },
          proposedAdaptationId: null,
          modelProvider,
          modelId,
        });
        return { message, proposedAdaptation: null };
      }

      // Metadata-only bookkeeping on the memories this turn actually surfaced (§2.3).
      await bumpMemoryUsage({ repos, memories: [...pinned, ...ranked], now: nowDate });

      const message = await repos.coach.messages.create({
        role: "coach",
        text: result.text,
        localDate: input.localDate,
        // MAP the bounded `coachToolLog` shape from the result — never store it verbatim.
        toolLogJson: {
          degraded: result.degraded,
          stepsUsed: result.stepsUsed,
          entries: result.toolLog.map((entry) => ({
            tool: entry.tool,
            ok: entry.ok,
            args: toLogArgs(entry.args),
            resultSummary: entry.resultSummary,
            entryIds: entry.entries.filter((row) => row.entryId !== null).map((row) => row.entryId as string),
          })),
        },
        // COACH-3: the agent loop created the `status:"proposed"` row inside runCoachAgent;
        // link its id here so the persisted coach turn opens the Keep/Revert dialog on it.
        proposedAdaptationId: result.proposedAdaptation?.id ?? null,
        modelProvider,
        modelId,
      });

      return { message, proposedAdaptation: result.proposedAdaptation };
    },
    proposeAdaptation(input) {
      // Same dedupe + create the conversational agent uses (shared `proposeAdaptationRow`),
      // so re-entry and conversation converge on one AdaptationRecord shape and one dedupe.
      return proposeAdaptationRow({ repos, planItemId: input.planItemId, before: input.before, after: input.after, reason: input.reason });
    },
    async findReentryAdaptation(input) {
      const [progress, planItems] = await Promise.all([repos.plans.progress.list({}), repos.plans.items.list({})]);
      const candidate = deriveReentryCandidate({ localDate: input.localDate, progress, planItems });
      if (!candidate) return null;
      // One adaptation owns one re-entry absence episode per plan item. Once it is
      // proposed, kept, or reverted, repeated opens must surface that lifecycle
      // rather than repeatedly reducing an already-kept numeric target.
      return (await repos.coach.adaptations.list({}))
        .filter((adaptation) => adaptation.planItemId === candidate.planItemId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0] ?? null;
    },
    async ensureReentryAdaptation(input) {
      const existing = await this.findReentryAdaptation(input);
      if (existing) return existing;
      const [progress, planItems] = await Promise.all([repos.plans.progress.list({}), repos.plans.items.list({})]);
      const candidate = deriveReentryCandidate({ localDate: input.localDate, progress, planItems });
      return candidate ? this.proposeAdaptation(candidate) : null;
    },
    async resolveAdaptation(input) {
      const adaptation = await repos.coach.adaptations.byId(input.adaptationId);
      if (!adaptation) throw new Error("adaptation is unavailable in this scope");
      if (input.action === "revert") {
        if (adaptation.status !== "proposed") throw new Error("adaptation is not an open scoped proposal");
        return repos.coach.adaptations.update(adaptation.id, { status: "reverted", revertedAt: now(), appliedCommitId: null });
      }
      return (await commits.applyAdaptationPlanPatch({ adaptationId: adaptation.id, idempotencyKey: `adaptation:${adaptation.id}` })).adaptation;
    },
    gameSummary(input) {
      return loadSummary(input.localDate);
    },
  };
}
