import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/SignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your account — Sarthi",
  robots: { index: false },
};

export default function SignupPage() {
  return <SignupForm />;
}
