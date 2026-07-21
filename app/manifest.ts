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
    // Stable app identity — decouples "which installed app is this" from start_url so a
    // future start_url change never spawns a duplicate installed instance.
    id: "/",
    name: "Sarthi",
    short_name: "Sarthi",
    description:
      "A voice-and-photo life coach — one sentence, your whole life sorted.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: CANVAS_DARK,
    theme_color: CANVAS_DARK,
    categories: ["lifestyle", "health", "productivity"],
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
    // Long-press / app-icon shortcuts. "Capture" deep-links to Today with the composer
    // auto-opened (CaptureLauncher reads `?capture=1`). Icons reuse the code-gen PNG route.
    shortcuts: [
      {
        name: "Capture",
        short_name: "Capture",
        description: "Tell Sarthi about your day",
        url: "/today?capture=1",
        icons: [{ src: "/icon-192", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Today",
        short_name: "Today",
        description: "Your day at a glance",
        url: "/today",
        icons: [{ src: "/icon-192", sizes: "192x192", type: "image/png" }],
      },
    ],
    // screenshots: deliberately omitted — they require binary/rendered image assets, and
    // this layer is code-gen-icons-only (no binary assets). A richer install dialog can add
    // them later via an OG-style route without touching this contract.
  };
}
