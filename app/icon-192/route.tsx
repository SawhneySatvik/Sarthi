import { renderMark } from "../lib/brand-mark";

export function GET() {
  return renderMark({ dimension: 192, scale: 0.66 });
}
