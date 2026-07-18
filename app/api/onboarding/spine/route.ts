import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
import { coreAnswersSchema, generateSpine, spineDomainEnum } from "@/core/onboarding";

/*
 * POST /api/onboarding/spine (SAR-012 Pass 2, D-E) — one deep-tier spine per domain.
 * Body: { domain, answers }. Runs keyless on the fake stack (answer-derived deriveSpine).
 * The client fires 1–4 of these in PARALLEL, each under an 8s AbortController budget; a
 * domain that fails/overruns renders its own retry skeleton and retries by re-POSTing just
 * that domain (§10) — per-domain independence falls out of the one-domain-per-call shape.
 * A failed generation is a retryable 502 with NO plan rows (nothing writes here — the
 * single onboarding write is the D-accept tap).
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { domain?: unknown; answers?: unknown };
  const domain = spineDomainEnum.safeParse(body.domain);
  const answers = coreAnswersSchema.safeParse(body.answers);
  if (!domain.success || !answers.success) {
    return NextResponse.json({ ok: false, retryable: false, error: "invalid spine request" }, { status: 400 });
  }

  const { llm } = await getSession();
  const result = await generateSpine({ domain: domain.data, answers: answers.data }, llm);

  if (!result.ok) {
    return NextResponse.json({ ok: false, retryable: result.retryable, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, spine: result.spine });
}
