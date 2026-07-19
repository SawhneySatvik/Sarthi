import type { MediaProvider } from "@/core/contracts";
import { FakeMediaProvider } from "./fake";
import { ProductionMediaProvider } from "./production";

export function createMediaProvider(kind: "fake" | "production" = "fake"): MediaProvider {
  return kind === "production" ? new ProductionMediaProvider() : new FakeMediaProvider();
}
