import type { ObjectResult, VisionProvider } from "@/core/contracts";
import type { z } from "zod";
import { ESTIMATED_MEAL_PHOTO_FIXTURE, RECEIPT_BATCH_FIXTURE } from "./fixtures";

const FAKE_VISION_USAGE = Object.freeze({ inputTokens: 31, outputTokens: 16 });

function shouldUseReceiptFixture(input: { images: readonly { filename?: string }[]; prompt: string }): boolean {
  const firstFilename = input.images[0]?.filename?.toLowerCase() ?? "";
  return firstFilename.includes("receipt") || input.prompt.toLowerCase().includes("receipt");
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
