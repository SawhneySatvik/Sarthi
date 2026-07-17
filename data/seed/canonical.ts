import type { UserScopedRepositories } from "@/core/contracts";

/**
 * data/seed/canonical.ts — SAR-006 (D-K). Ensure the entities the canonical capture
 * fixture resolves against exist for a user: the "Food & dining" money category, the
 * "System design" skill, and the "Wake by 5:30 AM" habit. Without them the two
 * explicit high-confidence proposals fail name-resolution and demote to pending, so
 * F3's "explicit values file into the strip" moment breaks.
 *
 * Per D-C (SAR-004), capture NEVER auto-creates a category/skill/habit — they must
 * pre-exist. This is the dev/eval seed; production onboarding (SAR-016) owns the real
 * bootstrap. Idempotent: create-if-missing (case-insensitive), so it is safe to run
 * against an already-seeded scope (SAR-007 reuses it).
 */
export async function seedCanonicalEntities(repos: UserScopedRepositories): Promise<void> {
  const categories = await repos.money.categories.list({});
  if (!categories.some((c) => c.name.toLowerCase() === "food & dining")) {
    await repos.money.categories.create({ name: "Food & dining", kind: "expense", colorKey: "amber", isSystem: true });
  }

  const skills = await repos.skills.skills.list({});
  if (!skills.some((s) => s.name.toLowerCase() === "system design")) {
    await repos.skills.skills.create({ name: "System design", targetMinutes: null, isArchived: false });
  }

  const habits = await repos.habits.habits.list({});
  if (!habits.some((h) => h.name.toLowerCase() === "wake by 5:30 am")) {
    await repos.habits.habits.create({
      name: "Wake by 5:30 AM",
      cadence: "daily",
      difficulty: "medium",
      targetValue: null,
      targetUnit: null,
      isArchived: false,
    });
  }
}
