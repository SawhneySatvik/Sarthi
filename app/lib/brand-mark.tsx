/**
 * app/lib/brand-mark.tsx — the Sarthi app mark, generated (no binary assets).
 *
 * Renders the Devanagari glyph "स" (from सारथी / Sarthi — the charioteer-guide)
 * in a serif, warm off-white on the Bone dark canvas. Colors come from
 * ./brand-canvas (mirrors the globals.css tokens; literals required because
 * next/og cannot read CSS variables). next/og (Satori) ships Devanagari
 * coverage, so this renders keyless/offline with no font fetch. `scale`
 * shrinks the glyph for maskable safe-zone padding.
 */
import { ImageResponse } from "next/og";
import { CANVAS_DARK, CANVAS_LIGHT } from "./brand-canvas";

const MARK = "स";

export function renderMark({
  dimension,
  scale = 0.66,
}: {
  dimension: number;
  scale?: number;
}): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: CANVAS_DARK,
          color: CANVAS_LIGHT,
          fontFamily: "serif",
          fontSize: Math.round(dimension * scale),
          lineHeight: 1,
        }}
      >
        {MARK}
      </div>
    ),
    { width: dimension, height: dimension },
  );
}
