import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSessionForRuntimeRequest } from "@/app/lib/session";
import { isRuntimeOverrideError } from "@/app/lib/runtimeOverride";
import { withByok } from "@/app/lib/byok";
import { assessAfford, rupeesToPaise } from "@/core/tools";

/**
 * POST /api/tools/afford/check (T4, D-017 → Money). Deep-tier verdict over the real ledger.
 * ADVICE ONLY — this route never writes. The price is re-derived to integer paise server-side
 * (rupee string OR pre-parsed paise), so a malformed amount is a 400, never a phantom value.
 * The verdict runs keyless on the fake deep tier; a BYOK/override key routes it live.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      item?: unknown;
      pricePaise?: unknown;
      priceRupees?: unknown;
    };
    const item = typeof body.item === "string" ? body.item : "";
    const pricePaise =
      typeof body.pricePaise === "number" && Number.isInteger(body.pricePaise) && body.pricePaise > 0
        ? body.pricePaise
        : typeof body.priceRupees === "string"
          ? rupeesToPaise(body.priceRupees)
          : null;
    if (!pricePaise || pricePaise <= 0) {
      return NextResponse.json({ ok: false, error: "a positive price is required" }, { status: 400 });
    }

    const { repos, llm } = withByok(await getSessionForRuntimeRequest(request), request);
    const localDate = new Date().toISOString().slice(0, 10);
    const assessment = await assessAfford({ repos, llm, localDate, input: { item, pricePaise } });
    return NextResponse.json({ ok: true, ...assessment });
  } catch (error) {
    if (error instanceof ZodError || isRuntimeOverrideError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "could not check affordability" }, { status: 500 });
  }
}
