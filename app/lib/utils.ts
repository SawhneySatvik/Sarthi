/**
 * app/lib/utils.ts — the `components.json` alias target (`@/app/lib/utils`).
 * A dependency-free `cn()` for composing class names in the hand-rolled,
 * token-driven component kit (SAR-005, D-I). No tailwind-merge needed: the kit
 * owns its classes, so there are no conflicting utilities to dedupe.
 */
export type ClassValue = string | number | null | false | undefined | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input && input !== 0) continue;
    if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else {
      out.push(String(input));
    }
  }
  return out.join(" ");
}
