import type { LlmGateway, ObjectRequest, ObjectResult, TextRequest } from "@/core/contracts";
import { readFillEnvelope } from "@/core/onboarding";
import type { z } from "zod";
import {
  CANNED_ONBOARDING_FILLS,
  CANONICAL_CAPTURE_DRAFT_FIXTURE,
  CANNED_COACH_LINE_FIXTURE,
  DETERMINISTIC_BRIEF_FIXTURE,
} from "./fixtures";

const FAKE_LATENCY_MS = 7;
const FAKE_USAGE = Object.freeze({ inputTokens: 42, outputTokens: 18 });

function fixtureForObject(operation: ObjectRequest<z.ZodType>["telemetry"]["operation"]): unknown {
  if (operation === "capture-parse") {
    return CANONICAL_CAPTURE_DRAFT_FIXTURE;
  }
  return DETERMINISTIC_BRIEF_FIXTURE;
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

function fixtureForText(operation: TextRequest["telemetry"]["operation"]): string {
  return operation === "capture-line" ? CANNED_COACH_LINE_FIXTURE.text : DETERMINISTIC_BRIEF_FIXTURE.text;
}

export class FakeLlmGateway implements LlmGateway {
  async generateObject<TSchema extends z.ZodType>(
    request: ObjectRequest<TSchema>,
  ): Promise<ObjectResult<z.infer<TSchema>>> {
    const { operation } = request.telemetry;
    if (operation === "onboarding-spine") {
      // The spine dispatch (answer-derived deriveSpine) lands in SAR-012 Pass 2; a call
      // here now is a wiring error, so fail loudly rather than return the brief fixture.
      throw new Error("onboarding-spine is not wired on the fake stack until SAR-012 Pass 2");
    }
    const fixture = operation === "onboarding-fill" ? fixtureForFill(request.prompt) : fixtureForObject(operation);
    const object = request.schema.parse(fixture);
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
      text: fixtureForText(request.telemetry.operation),
      modelId: `fake-${request.tier}-v1`,
      provider: "fake" as const,
      latencyMs: FAKE_LATENCY_MS,
    };
  }
}
