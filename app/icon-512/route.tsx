import { renderMark } from "../lib/brand-mark";

export function GET() {
  return renderMark({ dimension: 512, scale: 0.66 });
}
