import { redirect } from "next/navigation";

import { getSession } from "@/app/lib/session";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

// Reads the per-user scope at request time — never statically generated.
export const dynamic = "force-dynamic";

/*
 * /onboarding — SAR-012 Pass 1 (D-B). The server entry to the onboarding walk. A hard
 * reload with an already-`complete` profile bounces to /today (the re-entry guard); a
 * fresh user (no profile / not complete) gets the client flow. `authMode` seeds Phase A:
 * keyless (`local`) renders NO sign-in affordance (D-C); the prod link waits for SAR-021.
 * Nothing is written here — the only persistence in Pass 1 is the client-local draft.
 */
export default async function OnboardingPage() {
  const { user, repos } = await getSession();
  const profile = await repos.profile.profiles.byId(user.userId);
  if (profile && profile.onboardingStatus === "complete") {
    redirect("/today");
  }
  return <OnboardingFlow authMode={user.mode} />;
}
