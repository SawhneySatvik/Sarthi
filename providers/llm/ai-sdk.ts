import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, type LanguageModel, type ModelMessage } from "ai";
import { z } from "zod";

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

/**
 * Pull the single JSON object out of a model's text response. Strips an optional
 * ```json fence, then slices to the outermost braces so leading/trailing prose
 * (forbidden by the prompt, but some models emit it anyway) can't break
 * `JSON.parse`. If there are no object braces the raw text is returned so the
 * caller's `JSON.parse` throws — never a silent bad parse.
 */
function extractJsonObject(text: string): string {
  let trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    trimmed = fenced[1].trim();
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last <= first) {
    return trimmed;
  }
  return trimmed.slice(first, last + 1);
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

    // Gemini's native structured output builds an OpenAPI-3.0-subset `responseSchema`
    // that REJECTS discriminated unions / `oneOf` — and the F3 `captureDraftSchema`
    // embeds one. So for the google provider we never hand the Zod schema to the SDK's
    // `generateObject`; we take back free-form JSON text and validate locally instead.
    if (this.provider === "google") {
      return this.generateObjectViaJsonText(request, startedAt);
    }

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

  /**
   * Google-only structured-output path that avoids Gemini's union-hostile
   * `responseSchema`. The target shape is described as a JSON Schema *inside the
   * prompt* (guidance text only — it is NEVER sent to the provider as a response
   * schema), we take back free-form text, extract the JSON object, and validate it
   * with the caller's Zod schema. Any parse/validate failure THROWS, so the caller's
   * try/catch (`core/capture/parse.ts`) turns it into a retryable zero-row draft —
   * invariant #1: a failed parse never becomes a silent bad write. Images thread
   * through `promptMessages`, so the vision adapter (which reuses this gateway) is
   * fixed by the same code path.
   */
  private async generateObjectViaJsonText<TSchema extends z.ZodType>(
    request: ObjectRequest<TSchema>,
    startedAt: number,
  ): Promise<ObjectResult<z.infer<TSchema>>> {
    let shapeHint: string;
    try {
      shapeHint = JSON.stringify(z.toJSONSchema(request.schema));
    } catch {
      // Defensive: if the schema can't render to JSON Schema, fall back to a
      // shape-free instruction. Local validation below still guarantees correctness
      // (an unusable object simply throws → retryable draft).
      shapeHint = "(schema description unavailable — return the object the system prompt describes)";
    }

    const system =
      `${request.system}\n\n` +
      "Respond with ONE JSON object and nothing else: no markdown, no code fences, no " +
      "commentary. Include every required field; use null (not omission) where the schema " +
      "allows null; use integer values where required. The object MUST validate against this " +
      "JSON Schema:\n" +
      shapeHint;

    const result = await generateText({
      model: this.modelFor(request.tier),
      system,
      messages: promptMessages(request.prompt, request.images),
      telemetry: { isEnabled: true, functionId: request.telemetry.operation },
    });

    let candidate: unknown;
    try {
      candidate = JSON.parse(extractJsonObject(result.text));
    } catch {
      throw new Error("google generateObject: model response was not parseable JSON");
    }

    const validated = request.schema.safeParse(candidate);
    if (!validated.success) {
      throw new Error(
        `google generateObject: response failed schema validation — ${validated.error.message}`,
      );
    }

    return {
      object: validated.data as z.infer<TSchema>,
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
