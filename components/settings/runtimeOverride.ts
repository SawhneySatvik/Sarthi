"use client";

import type { LlmProviderName } from "@/core/contracts";

/**
 * Volatile, browser-memory only runtime choice. It intentionally has no storage
 * backing: a reload restores the server environment default. Request clients may
 * read it and attach the allowlisted header; server routes still own enforcement.
 */
let providerOverride: LlmProviderName | null = null;
const listeners = new Set<() => void>();

export function getRuntimeProviderOverride(): LlmProviderName | null {
  return providerOverride;
}

export function setRuntimeProviderOverride(provider: LlmProviderName | null): void {
  providerOverride = provider;
  for (const listener of listeners) listener();
}

export function subscribeRuntimeProviderOverride(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function runtimeProviderHeaders(): HeadersInit {
  return providerOverride ? { "x-sarthi-llm-provider": providerOverride } : {};
}
