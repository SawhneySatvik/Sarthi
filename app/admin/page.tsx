import { requireAdminContext } from "@/app/lib/admin";

import { AdminWaitlistView } from "./AdminWaitlistView";

/*
 * app/admin/page.tsx — the gated PL-2 admin surface. `requireAdminContext()` enforces
 * supabase auth + the ADMIN_EMAILS allowlist and 404s (`notFound`) for anyone else — the
 * anonymous demo, a normal signed-in user, or any non-supabase boot never reach it. It then
 * reads ALL waitlist rows through the unscoped admin seam and hands them to the presentational
 * view. Sits OUTSIDE the (app)/(auth) route groups: no app nav, no onboarding gate.
 */
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { email, repo } = await requireAdminContext();
  const rows = await repo.listAll();
  return <AdminWaitlistView rows={rows} adminEmail={email} />;
}
