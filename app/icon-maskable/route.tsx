import { renderMark } from "../lib/brand-mark";

// Maskable safe zone: glyph kept within the inner ~80% circle (scale 0.52),
// while the Bone canvas bleeds to the full 512×512 so launchers can crop.
export function GET() {
  return renderMark({ dimension: 512, scale: 0.52 });
}
