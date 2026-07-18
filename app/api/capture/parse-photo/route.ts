import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/session";
import { parsePhoto, visionPhotoTypeEnum } from "@/core/capture";
import type { ImageInput } from "@/core/contracts";

/*
 * POST /api/capture/parse-photo (SAR-011, D-C) — the photo parse seam. A thin adapter
 * that mirrors /api/capture/parse: it validates the multipart upload, hands the bytes
 * to the INJECTED VisionProvider (fake stack, keyless), and returns the same
 * `{ ok, draft }` / retryable-502 shape so CaptureSheet's post-parse code path is
 * shared byte-for-byte with the text path.
 *
 * FormData: `photo` (File), `timezone`, `type` (meal|receipt — the UI toggle drives
 * which canned fixture the fake returns), optional `caption`. The photo bytes live only
 * in request memory — nothing is written to disk/DB/storage (persistence is a later
 * ticket; `evidenceId` stays null in commit). A failed parse is a retryable 502 with
 * ZERO rows — never a silent write.
 */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(mime);
}

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "expected multipart form data" }, { status: 400 });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ ok: false, error: "photo required" }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ ok: false, error: "photo too large (max 8 MB)" }, { status: 413 });
  }
  const mimeType = photo.type;
  if (!isAllowedMime(mimeType)) {
    return NextResponse.json({ ok: false, error: "unsupported image type" }, { status: 400 });
  }

  const timezoneRaw = form.get("timezone");
  const timezone = typeof timezoneRaw === "string" && timezoneRaw ? timezoneRaw : "UTC";
  // Ask-don't-invent (invariant #1): the meal/receipt toggle drives which fixture the
  // fake returns, so an invalid OR missing `type` is a 400 — never silently coerced to
  // "meal" (a wrong guess would parse the photo down the wrong domain).
  const parsedType = visionPhotoTypeEnum.safeParse(form.get("type"));
  if (!parsedType.success) {
    return NextResponse.json({ ok: false, error: 'type must be "meal" or "receipt"' }, { status: 400 });
  }
  const photoType = parsedType.data;
  const captionRaw = form.get("caption");
  const caption = typeof captionRaw === "string" && captionRaw ? captionRaw : null;

  const image: ImageInput = {
    bytes: new Uint8Array(await photo.arrayBuffer()),
    mimeType,
    filename: photo.name || undefined,
  };

  const { vision } = await getSession();
  const result = await parsePhoto(
    { images: [image], timezone, capturedAt: new Date().toISOString(), photoType, caption },
    vision,
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, retryable: result.retryable, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, draft: result.draft });
}
