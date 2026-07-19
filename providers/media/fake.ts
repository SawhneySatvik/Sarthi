import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

import type { MediaProvider } from "@/core/contracts";

const MIME_EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" } as const;
const root = resolve(process.env.SARTHI_MEDIA_DIR ?? "/private/tmp/sarthi-media");

/** Keyless private-file adapter for dev/fake. Paths are opaque ids, never URLs. */
export class FakeMediaProvider implements MediaProvider {
  async put(input: { userId: string; bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp"; sha256: string }) {
    const directory = resolve(root, input.userId);
    if (!directory.startsWith(`${root}${sep}`)) throw new Error("invalid media user scope");
    await mkdir(directory, { recursive: true });
    const storagePath = `${randomUUID()}-${input.sha256.slice(0, 12)}${MIME_EXT[input.mimeType]}`;
    await writeFile(join(directory, storagePath), input.bytes, { flag: "wx" });
    return { storageProvider: "fake-local", storagePath };
  }

  async read(input: { userId: string; storagePath: string }) {
    const filename = basename(input.storagePath);
    if (filename !== input.storagePath || !MIME_EXT_BY_EXT[extname(filename)]) throw new Error("invalid media path");
    const directory = resolve(root, input.userId);
    const target = resolve(directory, filename);
    if (!target.startsWith(`${directory}${sep}`)) throw new Error("media scope violation");
    const mimeType = MIME_EXT_BY_EXT[extname(filename)];
    return { bytes: new Uint8Array(await readFile(target)), mimeType };
  }
}

const MIME_EXT_BY_EXT: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
};
