import type { ObjectResult, VisionProvider } from "@/core/contracts";
import type { z } from "zod";
import { ESTIMATED_MEAL_PHOTO_FIXTURE, RECEIPT_BATCH_FIXTURE } from "./fixtures";

const FAKE_VISION_USAGE = Object.freeze({ inputTokens: 31, outputTokens: 16 });

function shouldUseReceiptFixture(input: { prompt: string }): boolean {
  // SAR-011 override #1: the meal/receipt UI toggle is the SOLE driver — it selects the
  // fixture via the toggle-derived prompt, NOT the filename (a live camera snap has no
  // meaningful name, and a misleading name must never win). Deterministic and keyless.
  return input.prompt.toLowerCase().includes("receipt");
}

export class FakeVisionProvider implements VisionProvider {
  async analyze<TSchema extends z.ZodType>(input: {
    images: readonly import("@/core/contracts").ImageInput[];
    schema: TSchema;
    prompt: string;
    tier: "deep" | "balanced";
  }): Promise<ObjectResult<z.infer<TSchema>>> {
    const object = input.schema.parse(
      shouldUseReceiptFixture(input) ? RECEIPT_BATCH_FIXTURE : ESTIMATED_MEAL_PHOTO_FIXTURE,
    );
    return {
      object,
      modelId: `fake-vision-${input.tier}-v1`,
      provider: "fake",
      usage: { ...FAKE_VISION_USAGE },
      latencyMs: 9,
    };
  }
}
