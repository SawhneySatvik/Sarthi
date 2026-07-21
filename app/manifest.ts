import type { MetadataRoute } from "next";
import { CANVAS_DARK } from "./lib/brand-canvas";

/**
 * app/manifest.ts — installable PWA manifest, served by Next at
 * /manifest.webmanifest and auto-linked from the root layout. No service
 * worker is registered here (deliberately deferred). Colors are the Bone
 * dark canvas (see ./lib/brand-canvas). Icons are code-generated PNGs from
 * the route handlers below (no binary assets).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sarthi",
    short_name: "Sarthi",
    description:
      "A voice-and-photo life coach — one sentence, your whole life sorted.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: CANVAS_DARK,
    theme_color: CANVAS_DARK,
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
