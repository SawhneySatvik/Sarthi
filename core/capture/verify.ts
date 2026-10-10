/**
 * core/capture/verify.ts — the server double-check (DEVDAY-0 A1).
 *
 * When a proposal's numbers were filled by an outside model (e.g. ChatGPT tool
 * args), Sarthi does not trust its `estimated` flag blindly: every checked
 * quantity must LITERALLY appear in the user's own words. A number that does not
 * is demoted — `estimated:true`, `confidenceBps ≤ 8999` — so routing sends it to a
 * card (invariant #1: nothing estimated writes unconfirmed). Pure code, no model.
 *
 * Never promotes: an already-estimated proposal stays estimated. Untouched fields
 * stay untouched. Canonical display forms are built by integer divmod only (no
 * money/weight float math). Framework-clean: imports only `./contract` types.
 */
import type { Proposal } from "./contract";

export interface VerifyResult {
  proposal: Proposal;
  demotedReasons: string[];
}

/** Highest confidence a demoted proposal may carry (strictly below the 9000 auto threshold). */
const DEMOTED_MAX_CONFIDENCE_BPS = 8999;

/** Strip trailing zeros of a decimal fraction ("1.50" → "1.5", "2.0" → "2"). */
function trimFraction(value: string): string {
  if (!value.includes(".")) return value;
  const trimmed = value.replace(/0+$/, "");
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

/** Drop redundant leading zeros of the integer part ("05" → "5", "0.5" stays). */
function trimLeading(value: string): string {
  const [whole, frac] = value.split(".");
  const cleanWhole = whole.replace(/^0+(?=\d)/, "");
  return frac === undefined ? cleanWhole : `${cleanWhole}.${frac}`;
}

/** Every number token in `rawText`, comma-stripped and normalised. */
function numbersInText(rawText: string): Set<string> {
  const out = new Set<string>();
  for (const match of rawText.matchAll(/\d+(?:[.,]\d+)*/g)) {
    out.add(trimLeading(trimFraction(match[0].replace(/,/g, ""))));
  }
  return out;
}

/** True iff the canonical number form appears as a number token in `rawText`. */
export function numberAppearsInText(canonical: string, rawText: string): boolean {
  return numbersInText(rawText).has(trimLeading(trimFraction(canonical)));
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** Integer paise → rupee display form without symbol/grouping: 34000 → "340", 150 → "1.5". */
function paiseCanonical(paise: number): string {
  const paisePart = paise % 100;
  const rupees = (paise - paisePart) / 100;
  return paisePart === 0 ? String(rupees) : trimFraction(`${rupees}.${pad(paisePart, 2)}`);
}

/** Integer grams → kilogram display form: 1500 → "1.5", 72000 → "72". */
function gramsCanonical(grams: number): string {
  const frac = grams % 1000;
  const kg = (grams - frac) / 1000;
  return frac === 0 ? String(kg) : trimFraction(`${kg}.${pad(frac, 3)}`);
}

interface Check {
  canonical: string;
  label: string;
}

/** The literal-number checks per kind. Null optional fields are skipped. */
function checksFor(proposal: Proposal): Check[] {
  switch (proposal.kind) {
    case "transaction": {
      const c = paiseCanonical(proposal.payload.amountPaise);
      return [{ canonical: c, label: `₹${c}` }];
    }
    case "meal": {
      const checks: Check[] = [{ canonical: String(proposal.payload.kcal), label: `${proposal.payload.kcal} kcal` }];
      const macros: [number | null, string][] = [
        [proposal.payload.proteinGrams, "protein"],
        [proposal.payload.carbsGrams, "carbs"],
        [proposal.payload.fatGrams, "fat"],
      ];
      for (const [grams, name] of macros) {
        if (grams !== null) checks.push({ canonical: String(grams), label: `${grams} g ${name}` });
      }
      return checks;
    }
    case "water":
      return proposal.payload.millilitres === null
        ? []
        : [{ canonical: String(proposal.payload.millilitres), label: `${proposal.payload.millilitres} ml` }];
    case "workout": {
      const checks: Check[] = [
        { canonical: String(proposal.payload.durationMinutes), label: `${proposal.payload.durationMinutes} min` },
      ];
      if (proposal.payload.burnKcal !== null) {
        checks.push({ canonical: String(proposal.payload.burnKcal), label: `${proposal.payload.burnKcal} kcal burned` });
      }
      return checks;
    }
    case "weighIn": {
      const c = gramsCanonical(proposal.payload.weightGrams);
      return [{ canonical: c, label: `${c} kg` }];
    }
    case "skillSession":
      return [{ canonical: String(proposal.payload.minutes), label: `${proposal.payload.minutes} min` }];
    case "habitLog":
      return [];
  }
}

/**
 * Demote any proposal whose checked numbers are not literally in the user's words.
 * Returns the (possibly demoted) proposal and one human reason per miss.
 */
export function verifyAgainstText(proposal: Proposal, rawText: string): VerifyResult {
  const present = numbersInText(rawText);
  const demotedReasons: string[] = [];
  for (const check of checksFor(proposal)) {
    if (!present.has(trimLeading(trimFraction(check.canonical)))) {
      demotedReasons.push(`ChatGPT estimated ${check.label} — that number isn't in your words`);
    }
  }
  if (demotedReasons.length === 0) {
    return { proposal, demotedReasons };
  }
  return {
    proposal: {
      ...proposal,
      estimated: true,
      confidenceBps: Math.min(proposal.confidenceBps, DEMOTED_MAX_CONFIDENCE_BPS),
      why: { ...proposal.why, assumptions: [...proposal.why.assumptions, ...demotedReasons] },
    },
    demotedReasons,
  };
}
