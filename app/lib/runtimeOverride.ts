import type { LlmProviderName } from "@/core/contracts";
import { LLM_MODEL_MATRIX } from "@/providers/llm/matrix";

import type { RuntimeConfig } from "./runtime";

export const RUNTIME_LLM_PROVIDER_HEADER = "x-sarthi-llm-provider";

/** A request asked for a selector that is unavailable in this runtime. */
export class RuntimeOverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeOverrideError";
  }
}

const REQUEST_SELECTABLE_LLM_PROVIDERS = new Set<LlmProviderName>(["fake", "google", "openai"]);

/** Public production has no runtime provider controls, including hidden headers. */
export function isDeveloperControlAllowed(
  config: Pick<RuntimeConfig, "judgeMode">,
  nodeEnvironment = process.env.NODE_ENV,
): boolean {
  return nodeEnvironment !== "production" || config.judgeMode;
}

function isSelectableLlmProvider(provider: string): provider is LlmProviderName {
  if (!REQUEST_SELECTABLE_LLM_PROVIDERS.has(provider as LlmProviderName)) return false;
  return Object.values(LLM_MODEL_MATRIX[provider as LlmProviderName]).every((modelId) => modelId !== null);
}

/**
 * Resolves the volatile client selector only after the route has bound an authenticated
 * session. This is deliberately header-only: no cookie, storage, environment mutation,
 * or request cache participates in the choice.
 */
export function resolveRequestLlmProvider(
  headers: Headers,
  config: Pick<RuntimeConfig, "judgeMode">,
  nodeEnvironment = process.env.NODE_ENV,
): LlmProviderName | null {
  const requested = headers.get(RUNTIME_LLM_PROVIDER_HEADER);
  if (requested === null) return null;

  // Public production never exposes the developer control. A forged header is a
  // no-op rather than a distinguishable feature probe, so routes use their normal
  // configured provider.
  if (!isDeveloperControlAllowed(config, nodeEnvironment)) return null;

  if (!isSelectableLlmProvider(requested)) {
    throw new RuntimeOverrideError("requested runtime LLM provider is unavailable");
  }

  return requested;
}

export function isRuntimeOverrideError(error: unknown): error is RuntimeOverrideError {
  return error instanceof RuntimeOverrideError;
}
