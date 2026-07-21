/**
 * app/lib/brand-canvas.ts — literal mirrors of the Bone `--bg-canvas` tokens,
 * kept in one documented place for the app's non-DOM chrome:
 *   CANVAS_DARK  = --bg-canvas, Bone·dark  (app/globals.css:181)
 *   CANVAS_LIGHT = --bg-canvas, Bone·light (app/globals.css:208; a warm off-white)
 *
 * These are the ONLY sanctioned hex literals for the icon + PWA layer. The app
 * icon (next/og / Satori), the PWA manifest, and the <meta theme-color> tags
 * all render outside the DOM and cannot read CSS custom properties, so the
 * token values must be inlined. Centralizing them here keeps the .tsx surfaces
 * free of scattered hex (tokens-only UI, AGENTS.md §2).
 */
export const CANVAS_DARK = "#131211";
export const CANVAS_LIGHT = "#faf7f2";
