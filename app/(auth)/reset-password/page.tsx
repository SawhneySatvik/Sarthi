import type { Metadata } from "next";

import { ResetRequestForm } from "@/components/auth/ResetRequestForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset your password — Sarthi",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return <ResetRequestForm />;
}
