import type { Proposal } from "@/core/capture/contract";

/*
 * Presentation mapping for a proposal (SAR-006). Pure, client-safe display text +
 * the single editable primary field per kind (edit-in-place). Values are shown in a
 * human unit; `perUnit` converts the edited display value back to the stored integer
 * (₹→paise ×100, kg→grams ×1000; everything else ×1). habitLog edits its status.
 */
export interface PrimaryField {
  label: string;
  /** Display value (stored / perUnit), or null when the quantity is unknown. */
  value: number | null;
  unit: string;
  /** The payload key to patch on save. */
  editKey: string;
  /** stored = round(displayValue * perUnit). */
  perUnit: number;
}

export interface ProposalDisplay {
  domain: Proposal["domain"];
  title: string;
  primary: PrimaryField | null;
  /** habitLog: the primary "edit" is a done/skipped toggle, not a number. */
  statusToggle: "done" | "skipped" | null;
}

function field(value: number | null, label: string, unit: string, editKey: string, perUnit = 1): PrimaryField {
  return { label, value: value === null ? null : Math.round((value / perUnit) * 100) / 100, unit, editKey, perUnit };
}

export function displayProposal(p: Proposal): ProposalDisplay {
  switch (p.kind) {
    case "transaction":
      return { domain: p.domain, title: p.payload.merchant ?? "Expense", primary: field(p.payload.amountPaise, "Amount", "₹", "amountPaise", 100), statusToggle: null };
    case "meal":
      return { domain: p.domain, title: p.payload.note ?? "Meal", primary: field(p.payload.kcal, "Calories", "kcal", "kcal"), statusToggle: null };
    case "water":
      return { domain: p.domain, title: "Water", primary: field(p.payload.millilitres, "Volume", "ml", "millilitres"), statusToggle: null };
    case "workout":
      return { domain: p.domain, title: p.payload.note ?? "Workout", primary: field(p.payload.durationMinutes, "Duration", "min", "durationMinutes"), statusToggle: null };
    case "weighIn":
      return { domain: p.domain, title: "Weigh-in", primary: field(p.payload.weightGrams, "Weight", "kg", "weightGrams", 1000), statusToggle: null };
    case "habitLog":
      return { domain: p.domain, title: p.payload.habitName, primary: null, statusToggle: p.payload.status };
    case "skillSession":
      return { domain: p.domain, title: p.payload.skillName, primary: field(p.payload.minutes, "Duration", "min", "minutes"), statusToggle: null };
  }
}

/** The stored integer for an edited display value (inverse of PrimaryField.value). */
export function toStored(field: PrimaryField, displayValue: number): number {
  return Math.round(displayValue * field.perUnit);
}

/** Human string for a primary field ("₹340", "90 min", "unknown"). */
export function formatPrimary(field: PrimaryField | null): string | null {
  if (!field) return null;
  if (field.value === null) return "unknown";
  return field.unit === "₹" ? `₹${field.value}` : `${field.value} ${field.unit}`;
}
