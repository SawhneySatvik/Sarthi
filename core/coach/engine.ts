import { deriveGameSummary, deriveReentryCandidate, type GameSummary } from "@/core/game";

import { coachBriefOutputSchema, toCoachEvidence, type CoachEngine, type CreateCoachEngineOptions, type DateRange, type DomainCoachContext } from "./contract";
import { DOMAIN_REGISTRY } from "./registry";

function fingerprint(scope: "daily" | "weekly", range: DateRange, contexts: readonly DomainCoachContext[], profileGapKey: string | null): string {
  const items = contexts.flatMap((context) => context.evidence).map((item) => [item.domain, item.entryKind, item.entryId ?? "", item.valueInt ?? "", item.unit ?? "", item.label].join("|"));
  return `${scope}:${range.start}:${range.end}:${[...items, profileGapKey ?? ""].sort().join(";")}`;
}

function weekEnd(weekStart: string): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 6));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function askTier(text: string): "fast" | "deep" {
  return /\b(plan|budget|spend|money|paise|rupee|₹|adjust)\b/i.test(text) ? "deep" : "fast";
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
      system: "Write a concise, grounded life-coach brief. Use only the supplied typed evidence. Never claim a plan changed unless it is visibly proposed.",
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
        system: "Write one short, warm reaction grounded in a completed capture.",
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
    async ask(input) {
      const text = input.text.trim();
      if (!text) throw new Error("coach question is required");
      const result = await llm.generateText({
        tier: askTier(text),
        system: "Answer in two to four grounded, informational sentences. Do not write plans or entries.",
        prompt: JSON.stringify({ text, timezone: input.timezone }),
        telemetry: { operation: "coach-ask" },
      });
      return { text: result.text, ...(askTier(text) === "deep" ? { action: "adjust-plan" as const } : {}) };
    },
    async proposeAdaptation(input) {
      if (
        input.before.entryKind !== "planItem" || input.after.entryKind !== "planItem" ||
        input.before.entryId !== input.planItemId || input.after.entryId !== input.planItemId
      ) throw new Error("adaptation must contain one matching typed plan-item patch");
      const equivalent = (await repos.coach.adaptations.list({})).find((adaptation) =>
        adaptation.status === "proposed" && adaptation.planItemId === input.planItemId &&
        JSON.stringify(adaptation.beforeJson) === JSON.stringify(input.before) && JSON.stringify(adaptation.afterJson) === JSON.stringify(input.after),
      );
      if (equivalent) return equivalent;
      return repos.coach.adaptations.create({
        planItemId: input.planItemId,
        beforeJson: input.before,
        afterJson: input.after,
        reason: input.reason,
        status: "proposed",
        keptAt: null,
        revertedAt: null,
        appliedCommitId: null,
      });
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
