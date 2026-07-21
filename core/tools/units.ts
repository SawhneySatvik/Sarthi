/**
 * core/tools/units.ts — framework-clean integer-unit parsing for the SAR-017 tools (T4).
 *
 * No floats for money or load: rupees become integer PAISE and kilograms become integer
 * GRAMS by string divmod (the exact inverse of `formatPaise`), never `parseFloat(x) * 100`
 * — which silently corrupts amounts like `0.10 * 100 = 10.000000000000002` or
 * `19.99 * 100 = 1998.9999…`. A malformed or non-positive money amount returns `null`, so
 * an unparseable price can never become a phantom write (invariant #1/#2).
 */

/**
 * Parse a user-typed rupee amount ("340", "1.50", "1,000", "₹99") to a strictly POSITIVE
 * integer paise, or `null` when it is not a clean 0/1/2-decimal positive amount.
 * ₹340 → 34000 · ₹1.50 → 150 · ₹19.99 → 1999 · ₹0.10 → 10.
 */
export function rupeesToPaise(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise) || paise <= 0) return null;
  return paise;
}

/**
 * Parse a user-typed kilogram load ("12.5", "20", "0.25") to a NON-NEGATIVE integer grams,
 * or `null` when the field is blank/unparseable (a bodyweight set has no recorded load —
 * ask-don't-invent: we never fabricate a load). 12.5 kg → 12500 g · 0.25 kg → 250 g.
 */
export function kilogramsToGrams(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const grams = Number(whole) * 1000 + Number(frac.padEnd(3, "0"));
  if (!Number.isSafeInteger(grams) || grams < 0) return null;
  return grams;
}
