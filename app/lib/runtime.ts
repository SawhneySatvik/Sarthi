import "server-only";

import type {
  LlmProviderName,
  VisionProviderName,
  VoiceProviderName,
} from "@/core/contracts";
import { z } from "zod";

export type { LlmProviderName, VisionProviderName, VoiceProviderName } from "@/core/contracts";
export type AuthProviderName = "local-password" | "supabase";
export type DatabaseProviderName = "sqlite" | "postgres";
export type BillingMode = "checkout" | "waitlist";

export interface RuntimeConfig {
  llmProvider: LlmProviderName;
  voiceProvider: VoiceProviderName;
  visionProvider: VisionProviderName;
  authProvider: AuthProviderName;
  databaseProvider: DatabaseProviderName;
  billingMode: BillingMode;
  judgeMode: boolean;
  databaseUrl: string;
  appPassword?: string;
}

const runtimeEnvironmentSchema = z.object({
  LLM_PROVIDER: z.enum(["fake", "google", "openai", "anthropic"]).default("fake"),
  VOICE_PROVIDER: z.enum(["fake", "gemini", "sarvam", "openai", "webspeech"]).default("fake"),
  VISION_PROVIDER: z.enum(["fake", "google", "openai"]).default("fake"),
  AUTH_PROVIDER: z.enum(["local-password", "supabase"]).default("local-password"),
  DATABASE_PROVIDER: z.enum(["sqlite", "postgres"]).default("sqlite"),
  BILLING_MODE: z.enum(["checkout", "waitlist"]).default("waitlist"),
  JUDGE_MODE: z.enum(["true", "false"]).default("false"),
  DB_URL: z.string().min(1).default("file:./sarthi.dev.db"),
  APP_PASSWORD: z.string().min(1).optional(),
});

/** Raw server environment values; selector validation happens inside the parser. */
export type RuntimeEnvironment = Record<string, string | undefined>;

export function parseRuntimeConfig(environment: RuntimeEnvironment = {}): RuntimeConfig {
  const parsed = runtimeEnvironmentSchema.parse(environment);

  return {
    llmProvider: parsed.LLM_PROVIDER,
    voiceProvider: parsed.VOICE_PROVIDER,
    visionProvider: parsed.VISION_PROVIDER,
    authProvider: parsed.AUTH_PROVIDER,
    databaseProvider: parsed.DATABASE_PROVIDER,
    billingMode: parsed.BILLING_MODE,
    judgeMode: parsed.JUDGE_MODE === "true",
    databaseUrl: parsed.DB_URL,
    appPassword: parsed.APP_PASSWORD,
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig(process.env);
}
