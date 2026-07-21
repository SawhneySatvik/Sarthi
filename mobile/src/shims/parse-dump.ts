import { captureDraftSchema, type CaptureDraft, FakeLlmGateway } from "./fake-llm";

export type ParseResult =
  | { ok: true; draft: CaptureDraft }
  | { ok: false; retryable: true; error: string };

export type ParseDumpInput = Readonly<{
  rawText: string;
  timezone: string;
  capturedAt: string;
  source?: CaptureDraft["source"];
  transcriptConfidenceBps?: number | null;
}>;

/**
 * The M0 on-device seam intentionally mirrors shared `core/capture/parse`:
 * provider output is schema-validated, trusted transport facts overwrite it,
 * and a parse failure remains retryable with no persistence side effect.
 */
export async function parseDump(input: ParseDumpInput, llm: FakeLlmGateway): Promise<ParseResult> {
  try {
    const parsed = captureDraftSchema.safeParse(await llm.generateObject(captureDraftSchema));
    if (!parsed.success) {
      return { ok: false, retryable: true, error: "capture-parse returned an object that failed the CaptureDraft schema" };
    }
    return {
      ok: true,
      draft: {
        ...parsed.data,
        rawText: input.rawText,
        capturedAt: input.capturedAt,
        timezone: input.timezone,
        source: input.source ?? "text",
        transcriptConfidenceBps: input.transcriptConfidenceBps ?? null,
      },
    };
  } catch (error) {
    return { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error) };
  }
}
