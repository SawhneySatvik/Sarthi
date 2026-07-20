import type { ImageInput, ObjectResult, VisionProvider } from "@/core/contracts";
import type { z } from "zod";

import { AiSdkLlmGateway } from "@/providers/llm/ai-sdk";

type LiveVisionProviderName = "google" | "openai";

const VISION_SYSTEM =
  "You are a precise vision parser. Extract only what is visibly present in the image; " +
  "never invent values. Integer units only (paise, ml, minutes, grams).";

/**
 * The live vision adapter. Vision is a `generateObject` call with image parts, so it
 * reuses the LLM gateway verbatim — same explicit-key construction, same matrix model
 * IDs, same integer-usage accounting. A per-request BYOK key threads through the
 * gateway's constructor and is never persisted, logged, or echoed.
 */
export class AiSdkVisionProvider implements VisionProvider {
  private readonly gateway: AiSdkLlmGateway;

  constructor(provider: LiveVisionProviderName, apiKey?: string) {
    this.gateway = new AiSdkLlmGateway(provider, apiKey);
  }

  async analyze<TSchema extends z.ZodType>(input: {
    images: readonly ImageInput[];
    schema: TSchema;
    prompt: string;
    tier: "deep" | "balanced";
  }): Promise<ObjectResult<z.infer<TSchema>>> {
    return this.gateway.generateObject({
      tier: input.tier,
      schema: input.schema,
      system: VISION_SYSTEM,
      prompt: input.prompt,
      images: input.images,
      telemetry: { operation: "vision" },
    });
  }
}
