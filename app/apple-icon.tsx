import { renderMark } from "./lib/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderMark({ dimension: 180, scale: 0.62 });
}
