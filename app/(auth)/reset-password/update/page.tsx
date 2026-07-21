import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set a new password — Sarthi",
  robots: { index: false },
};

/*
 * Reached only after the reset callback (`/auth/callback`) exchanges the emailed code for a
 * recovery session. The form saves the new password against that session, then signs out and
 * returns to /login. A visitor without a recovery session sees the form but the save fails with
 * the expired-link message.
 */
export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
