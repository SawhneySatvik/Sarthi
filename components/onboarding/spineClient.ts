"use client";

import type { CoreAnswers, DomainSpine, SpineDomain } from "@/core/onboarding";

/*
 * components/onboarding/spineClient.ts — SAR-012 Pass 2. The client seam to
 * POST /api/onboarding/spine for ONE domain, under an 8s AbortController budget (§5).
 * A non-2xx, a malformed body, a network error, OR the 8s overrun all resolve to
 * `failed` (never throw) — so a slow/failed domain renders its own retry skeleton (§10)
 * and the other domains proceed. Reused by Phase C (parallel) and Phase D (per-card retry).
 */

const SPINE_BUDGET_MS = 8000;

export type SpineOutcome =
  | { domain: SpineDomain; status: "done"; spine: DomainSpine }
  | { domain: SpineDomain; status: "failed" };

export async function requestSpine(domain: SpineDomain, answers: CoreAnswers): Promise<SpineOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SPINE_BUDGET_MS);
  try {
    const response = await fetch("/api/onboarding/spine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain, answers }),
      signal: controller.signal,
    });
    if (!response.ok) return { domain, status: "failed" };
    const data = (await response.json()) as { ok?: boolean; spine?: DomainSpine };
    if (!data?.ok || !data.spine) return { domain, status: "failed" };
    return { domain, status: "done", spine: data.spine };
  } catch {
    return { domain, status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}
