import type { Proposal, ProposalDomain } from "@core/capture/contract";

export interface ProposalPrimaryField {
  readonly label: string;
  readonly displayValue: number | null;
  readonly unit: string;
  readonly payloadKey: string;
  /** Stored integer = round(display value × multiplier). */
  readonly storedMultiplier: number;
}

export interface ProposalDisplay {
  readonly title: string;
  readonly detail: string;
  readonly primary: ProposalPrimaryField | null;
  readonly status: "done" | "skipped" | null;
}

function primary(value: number | null, label: string, unit: string, payloadKey: string, storedMultiplier = 1): ProposalPrimaryField {
  return {
    label,
    displayValue: value === null ? null : Math.round((value / storedMultiplier) * 100) / 100,
    unit,
    payloadKey,
    storedMultiplier,
  };
}

export function proposalDisplay(proposal: Proposal): ProposalDisplay {
  switch (proposal.kind) {
    case "transaction":
      return { title: proposal.payload.merchant ?? proposal.payload.categoryName, detail: proposal.payload.note ?? proposal.payload.direction, primary: primary(proposal.payload.amountPaise, "Amount", "₹", "amountPaise", 100), status: null };
    case "meal":
      return { title: proposal.payload.note ?? "Meal", detail: proposal.payload.items.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(" · "), primary: primary(proposal.payload.kcal, "Energy", "kcal", "kcal"), status: null };
    case "water":
      return { title: "Water", detail: "Captured water", primary: primary(proposal.payload.millilitres, "Volume", "ml", "millilitres"), status: null };
    case "workout":
      return { title: proposal.payload.note ?? "Workout", detail: proposal.payload.exercises.map((exercise) => exercise.name).join(" · ") || "Captured workout", primary: primary(proposal.payload.durationMinutes, "Duration", "min", "durationMinutes"), status: null };
    case "weighIn":
      return { title: "Weigh-in", detail: "Captured weight", primary: primary(proposal.payload.weightGrams, "Weight", "kg", "weightGrams", 1000), status: null };
    case "habitLog":
      return { title: proposal.payload.habitName, detail: proposal.payload.note ?? "Captured habit", primary: null, status: proposal.payload.status };
    case "skillSession":
      return { title: proposal.payload.skillName, detail: proposal.payload.note ?? "Captured session", primary: primary(proposal.payload.minutes, "Duration", "min", "minutes"), status: null };
  }
}

export function formatPrimary(field: ProposalPrimaryField | null): string | null {
  if (!field) return null;
  if (field.displayValue === null) return "Unknown";
  return field.unit === "₹" ? `₹${field.displayValue}` : `${field.displayValue} ${field.unit}`;
}

export function toStoredInteger(field: ProposalPrimaryField, displayValue: number): number {
  return Math.round(displayValue * field.storedMultiplier);
}

export function domainLabel(domain: ProposalDomain): string {
  return domain.slice(0, 1).toUpperCase() + domain.slice(1);
}
