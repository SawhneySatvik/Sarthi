import type { LlmGateway, ObjectRequest, ObjectResult, TextRequest } from "@/core/contracts";
import { coreAnswersSchema, deriveSpine, readFillEnvelope, readSpineEnvelope } from "@/core/onboarding";
import { deriveAffordVerdict, readAffordEnvelope } from "@/core/tools";
import type { z } from "zod";
import {
  CANNED_ONBOARDING_FILLS,
  CANONICAL_CAPTURE_DRAFT_FIXTURE,
  CANNED_COACH_LINE_FIXTURE,
  DETERMINISTIC_COACH_ASK_FIXTURE,
  DETERMINISTIC_BRIEF_FIXTURE,
  DETERMINISTIC_WEEKLY_BRIEF_FIXTURE,
} from "./fixtures";

const FAKE_LATENCY_MS = 7;
const FAKE_USAGE = Object.freeze({ inputTokens: 42, outputTokens: 18 });

function fixtureForObject(operation: ObjectRequest<z.ZodType>["telemetry"]["operation"], prompt: string): unknown {
  if (operation === "capture-parse") {
    return CANONICAL_CAPTURE_DRAFT_FIXTURE;
  }
  // T4 (D-017) — the keyless afford-it verdict is DERIVED from the ledger envelope in the
  // prompt, so it genuinely varies with price vs safe-to-spend (never a fixed string).
  if (operation === "afford-check") {
    const context = readAffordEnvelope(prompt);
    if (!context) throw new Error("afford-check prompt is missing its ledger envelope");
    return deriveAffordVerdict(context);
  }
  return /"scope":"weekly"/.test(prompt) ? DETERMINISTIC_WEEKLY_BRIEF_FIXTURE : DETERMINISTIC_BRIEF_FIXTURE;
}

/** SAR-012 (D-D) — the deterministic voice-fill dispatch: read the question key out of
 *  the prompt envelope and return that question's canned fields for the caller's schema. */
function fixtureForFill(prompt: string): unknown {
  const envelope = readFillEnvelope(prompt);
  if (!envelope) {
    throw new Error("onboarding-fill prompt is missing its question envelope");
  }
  return CANNED_ONBOARDING_FILLS[envelope.questionKey];
}

/** SAR-012 Pass 2 (D-E) — the deterministic, ANSWER-DERIVED spine dispatch: read the
 *  answers out of the prompt envelope and run `deriveSpine`, so the keyless spine genuinely
 *  varies with the answers. A missing/malformed envelope throws (NO silent fixture fallback).
 *  The caller's per-domain schema validates the result in `generateObject` below. */
function spineFromPrompt(prompt: string): unknown {
  const envelope = readSpineEnvelope(prompt);
  if (!envelope) {
    throw new Error("onboarding-spine prompt is missing its answers envelope");
  }
  const answers = coreAnswersSchema.parse(envelope.answers);
  return deriveSpine(envelope.domain, answers);
}

function fixtureForText(operation: TextRequest["telemetry"]["operation"]): string {
  return operation === "capture-line" ? CANNED_COACH_LINE_FIXTURE.text : DETERMINISTIC_COACH_ASK_FIXTURE.text;
}

function reflectionText(prompt: string): string {
  const parsed = JSON.parse(prompt) as { reflection?: { mood?: string; energyLevel?: number; sleepMinutes?: number | null; journal?: string }; facts?: unknown[] };
  const reflection = parsed.reflection;
  if (!reflection || typeof reflection.mood !== "string" || !Number.isInteger(reflection.energyLevel)) throw new Error("fake reflection prompt is malformed");
  const sleep = reflection.sleepMinutes === null ? "sleep not recorded" : `${reflection.sleepMinutes} minutes of sleep`;
  const note = typeof reflection.journal === "string" && reflection.journal.trim() ? ` You wrote: ${reflection.journal.trim().slice(0, 120)}` : "";
  const facts = Array.isArray(parsed.facts) ? parsed.facts.length : 0;
  return `${reflection.mood} mood and energy ${reflection.energyLevel}/5, with ${sleep}. ${facts} typed facts are recorded today.${note}`;
}

export class FakeLlmGateway implements LlmGateway {
  async generateObject<TSchema extends z.ZodType>(
    request: ObjectRequest<TSchema>,
  ): Promise<ObjectResult<z.infer<TSchema>>> {
    const { operation } = request.telemetry;
    const raw =
      operation === "onboarding-spine"
        ? spineFromPrompt(request.prompt)
        : operation === "onboarding-fill"
          ? fixtureForFill(request.prompt)
          : fixtureForObject(operation, request.prompt);
    const object = request.schema.parse(raw);
    return {
      object,
      modelId: `fake-${request.tier}-v1`,
      provider: "fake",
      usage: { ...FAKE_USAGE },
      latencyMs: FAKE_LATENCY_MS,
    };
  }

  async generateText(request: TextRequest) {
    return {
      text: request.telemetry.operation === "reflection-summary" ? reflectionText(request.prompt) : fixtureForText(request.telemetry.operation),
      modelId: `fake-${request.tier}-v1`,
      provider: "fake" as const,
      latencyMs: FAKE_LATENCY_MS,
    };
  }
}
