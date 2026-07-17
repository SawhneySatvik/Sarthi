import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, type ModelMessage } from "ai";
import type { z } from "zod";

import type {
  ImageInput,
  LlmGateway,
  LlmProviderName,
  ObjectRequest,
  ObjectResult,
  TextRequest,
} from "@/core/contracts";
import { resolveLlmModelId } from "./matrix";

type LiveLlmProviderName = Extract<LlmProviderName, "google" | "openai">;

function promptMessages(prompt: string, images: readonly ImageInput[] | undefined): ModelMessage[] {
  const content = [
    { type: "text" as const, text: prompt },
    ...(images ?? []).map((image) => ({
      type: "file" as const,
      data: image.bytes,
      mediaType: image.mimeType,
    })),
  ];

  return [{ role: "user", content }];
}

function integerUsage(usage: { inputTokens: number | undefined; outputTokens: number | undefined }) {
  return {
    inputTokens: Math.trunc(usage.inputTokens ?? 0),
    outputTokens: Math.trunc(usage.outputTokens ?? 0),
  };
}

export class AiSdkLlmGateway implements LlmGateway {
  constructor(private readonly provider: LiveLlmProviderName) {}

  private modelFor(tier: ObjectRequest<z.ZodType>["tier"]) {
    const modelId = resolveLlmModelId(this.provider, tier);
    return this.provider === "google" ? google(modelId) : openai(modelId);
  }

  async generateObject<TSchema extends z.ZodType>(
    request: ObjectRequest<TSchema>,
  ): Promise<ObjectResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const result = await generateObject({
      model: this.modelFor(request.tier),
      schema: request.schema,
      system: request.system,
      messages: promptMessages(request.prompt, request.images),
      telemetry: { isEnabled: true, functionId: request.telemetry.operation },
    });

    return {
      object: result.object as z.infer<TSchema>,
      modelId: resolveLlmModelId(this.provider, request.tier),
      provider: this.provider,
      usage: integerUsage(result.usage),
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }

  async generateText(request: TextRequest) {
    const startedAt = Date.now();
    const result = await generateText({
      model: this.modelFor(request.tier),
      system: request.system,
      prompt: request.prompt,
      telemetry: { isEnabled: true, functionId: request.telemetry.operation },
    });

    return {
      text: result.text,
      modelId: resolveLlmModelId(this.provider, request.tier),
      provider: this.provider,
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }
}
