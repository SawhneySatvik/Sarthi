import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, type LanguageModel, type ModelMessage } from "ai";
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
  /**
   * The provider client is constructed EXPLICITLY (not via the module-level `google`/
   * `openai` default singletons) so a per-request BYOK key can flow in transiently.
   * When `apiKey` is omitted the server env key is used — resolving BOTH the historical
   * `GOOGLE_API_KEY` name and the SDK's native `GOOGLE_GENERATIVE_AI_API_KEY`, so a
   * key set under either variable now works. `|| … || undefined` (not `??`) means an
   * empty-string env var can never shadow a later valid one. A BYOK key is held only in
   * this closure for the lifetime of the request — never logged, stored, or echoed.
   */
  private readonly client: (modelId: string) => LanguageModel;

  constructor(
    private readonly provider: LiveLlmProviderName,
    apiKey?: string,
  ) {
    this.client =
      provider === "google"
        ? createGoogleGenerativeAI({
            apiKey:
              apiKey ||
              process.env.GOOGLE_API_KEY ||
              process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
              undefined,
          })
        : createOpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || undefined });
  }

  private modelFor(tier: ObjectRequest<z.ZodType>["tier"]) {
    return this.client(resolveLlmModelId(this.provider, tier));
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
