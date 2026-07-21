import type { z } from "zod";

/** Provider selector values shared by the server composition root and provider ports. */
export type LlmProviderName = "fake" | "google" | "openai" | "anthropic";
export type VoiceProviderName = "fake" | "gemini" | "sarvam" | "openai" | "webspeech";
export type VisionProviderName = "fake" | "google" | "openai";
export type Tier = "deep" | "balanced" | "fast";

export interface ImageInput {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  filename?: string;
}

export interface VoiceAudio {
  bytes: Uint8Array;
  mimeType: "audio/webm" | "audio/wav" | "audio/mpeg";
  durationMs: number;
}

export interface Transcription {
  text: string;
  confidenceBps: number | null;
  languageCode: string | null;
}

export interface ObjectRequest<TSchema extends z.ZodType> {
  tier: Tier;
  schema: TSchema;
  system: string;
  prompt: string;
  images?: readonly ImageInput[];
  telemetry: {
    operation:
      | "capture-parse"
      | "coach-brief"
      | "coach-ask"
      | "vision"
      | "onboarding-spine"
      | "onboarding-fill"
      | "afford-check";
  };
}

export interface ObjectResult<T> {
  object: T;
  modelId: string;
  provider: LlmProviderName;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

export interface TextRequest {
  tier: Tier;
  system: string;
  prompt: string;
  telemetry: { operation: "capture-line" | "coach-ask" | "reflection-summary" };
}

export interface LlmGateway {
  generateObject<TSchema extends z.ZodType>(request: ObjectRequest<TSchema>): Promise<ObjectResult<z.infer<TSchema>>>;
  generateText(request: TextRequest): Promise<{
    text: string;
    modelId: string;
    provider: LlmProviderName;
    latencyMs: number;
  }>;
}

export interface VoiceProvider {
  transcribe(audio: VoiceAudio, options?: { languageHint?: string }): Promise<Transcription>;
  speak?(text: string, options: { languageCode: string; voice?: string }): Promise<{ bytes: Uint8Array; mimeType: string }>;
}

export interface VisionProvider {
  analyze<TSchema extends z.ZodType>(input: {
    images: readonly ImageInput[];
    schema: TSchema;
    prompt: string;
    tier: "deep" | "balanced";
  }): Promise<ObjectResult<z.infer<TSchema>>>;
}

export interface MediaProvider {
  put(input: { userId: string; bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp"; sha256: string }): Promise<{ storageProvider: string; storagePath: string }>;
  read(input: { userId: string; storagePath: string }): Promise<{ bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp" }>;
}
