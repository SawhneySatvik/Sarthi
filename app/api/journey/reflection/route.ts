import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/app/lib/session";
import { scrubProviderError, withByok } from "@/app/lib/byok";
import { summarizeReflection } from "@/core/coach";

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageMime = z.enum(["image/jpeg", "image/png", "image/webp"]);
const reflectionFields = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.enum(["rough", "low", "steady", "good", "great"]),
  energyLevel: z.coerce.number().int().min(1).max(5),
  sleepMinutes: z.union([z.literal(""), z.coerce.number().int().min(0).max(1440)]),
  journal: z.string().trim().max(4000),
});

/** Explicit, scoped Journey memory save. It intentionally never calls capture/XP/plan/coach services. */
export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const input = reflectionFields.parse({
      localDate: form.get("localDate"), mood: form.get("mood"), energyLevel: form.get("energyLevel"),
      sleepMinutes: form.get("sleepMinutes"), journal: form.get("journal"),
    });
    const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    if (images.length > MAX_IMAGES) return NextResponse.json({ ok: false, error: "You can add up to four images." }, { status: 400 });
    for (const image of images) {
      if (!imageMime.safeParse(image.type).success || image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ ok: false, error: "Images must be JPEG, PNG, or WebP and under 5 MB." }, { status: 400 });
      }
    }

    const { user, repos, media, llm } = withByok(await getSession(), request);
    const existing = (await repos.journey.reflections.list({ localDate: input.localDate }))[0] ?? null;
    const existingMedia = existing ? await repos.journey.media.list({ reflectionId: existing.id }) : [];
    if (existingMedia.length + images.length > MAX_IMAGES) return NextResponse.json({ ok: false, error: "This day already has four images." }, { status: 400 });
    const sleepMinutes = input.sleepMinutes === "" ? null : input.sleepMinutes;
    const summary = await summarizeReflection(repos, llm, { ...input, sleepMinutes });
    const reflection = existing
      ? await repos.journey.reflections.update(existing.id, { mood: input.mood, energyLevel: input.energyLevel, sleepMinutes, journal: input.journal, summary: summary.text, summaryProvider: summary.provider, summaryModelId: summary.modelId })
      : await repos.journey.reflections.create({ localDate: input.localDate, mood: input.mood, energyLevel: input.energyLevel, sleepMinutes, journal: input.journal, summary: summary.text, summaryProvider: summary.provider, summaryModelId: summary.modelId });

    const records = [];
    for (const image of images) {
      const bytes = new Uint8Array(await image.arrayBuffer());
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const mimeType = imageMime.parse(image.type);
      const stored = await media.put({ userId: user.userId, bytes, mimeType, sha256 });
      records.push(await repos.journey.media.create({ reflectionId: reflection.id, ...stored, mimeType, byteSize: bytes.byteLength, sha256, caption: null }));
    }
    return NextResponse.json({ ok: true, reflection, media: records });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: scrubProviderError(error instanceof Error ? error.message : "Could not save reflection.", request.headers) },
      { status: 400 },
    );
  }
}
