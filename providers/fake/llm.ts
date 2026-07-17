import type { LlmGateway, ObjectRequest, ObjectResult, TextRequest } from "@/core/contracts";
import type { z } from "zod";
import {
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

function fixtureForText(operation: TextRequest["telemetry"]["operation"]): string {
  return operation === "capture-line" ? CANNED_COACH_LINE_FIXTURE.text : DETERMINISTIC_BRIEF_FIXTURE.text;
}

export class FakeLlmGateway implements LlmGateway {
  async generateObject<TSchema extends z.ZodType>(
    request: ObjectRequest<TSchema>,
  ): Promise<ObjectResult<z.infer<TSchema>>> {
    const object = request.schema.parse(fixtureForObject(request.telemetry.operation));
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
