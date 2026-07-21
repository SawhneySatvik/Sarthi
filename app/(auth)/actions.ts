"use server";

import { notFound, redirect } from "next/navigation";

import { checkSignupGate } from "@/app/lib/admin";
import { getRuntimeConfig } from "@/app/lib/runtime";
import { createAuthProvider } from "@/providers/auth";
import type { AuthActionState } from "@/components/auth/types";

/*
 * app/(auth)/actions.ts — SAR-021 auth server actions. Each resolves the configured
 * `AuthProvider` (supabase in production; the account-lifecycle methods refuse under
 * local-password / anonymous, which is fine — those modes never route a stranger here) and
 * performs one email/password operation, setting the Supabase session cookies server-side.
 *
 * `redirect()` throws `NEXT_REDIRECT`, so every redirect sits OUTSIDE the try/catch that maps a
 * provider failure to an inline `state.error` (a caught redirect would swallow the navigation).
 */

const MIN_PASSWORD = 8;

function auth() {
  return createAuthProvider(getRuntimeConfig().authProvider);
}

/**
 * The account-creating actions (login/signup) EXIST ONLY under supabase. A direct POST to a
 * Server Action bypasses the `(auth)` layout guard, so re-assert it here: under any other
 * provider the route simply does not exist (404). Defense-in-depth over the provider's own
 * refusal — together they guarantee no phantom "success" on the anonymous/local deploy.
 */
function requireSupabaseAuth(): void {
  if (getRuntimeConfig().authProvider !== "supabase") {
    notFound();
  }
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Absolute callback URL for the reset email, derived from the request origin (never hardcoded). */
async function resetRedirectTarget(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const fromRequest = host ? `${proto}://${host}` : undefined;
  const origin = (fromRequest ?? process.env.VERCEL_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${origin}/auth/callback?next=/reset-password/update`;
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  requireSupabaseAuth();
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  try {
    await auth().signIn({ email, password });
  } catch {
    return { error: "Invalid email or password." };
  }
  // Completed users land on Today; the app shell's onboarding gate resumes an incomplete user
  // at /onboarding, so a single destination is self-correcting.
  redirect("/today");
}

export async function signupAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  requireSupabaseAuth();
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  if (!email || password.length < MIN_PASSWORD) {
    return { error: `Enter an email and a password of at least ${MIN_PASSWORD} characters.` };
  }
  // Selective rollout (PL-2): under supabase, only an approved/invited waitlist email (or an
  // allowlisted admin) may create an account. Everyone else gets a quiet waitlist notice — NOT an
  // account. Inert under local/anonymous (those providers refuse signUp regardless), so the
  // default stays unchanged.
  const gate = await checkSignupGate(email);
  if (!gate.allowed) {
    // Enumeration-safe: ONE notice regardless of `gate.onList`, so a probe cannot distinguish an
    // on-waitlist email from an unknown one (consistent with the login/reset posture).
    return {
      notice: "Sarthi is invite-only right now. Join the waitlist and we'll email you when a spot opens.",
    };
  }
  try {
    await auth().signUp({ email, password });
  } catch {
    return { error: "Could not create your account. Try a different email." };
  }
  // The frozen AuthProvider.signUp returns void and cannot report whether a session was
  // established (it depends on the project's email-confirmation setting). Decide routing on
  // ACTUAL session presence: sign in immediately — success means auto-confirm → onboarding;
  // failure means a confirmation email is pending → a quiet notice (never a redirect wall).
  try {
    await auth().signIn({ email, password });
  } catch {
    return { notice: "Account created. Check your email to confirm, then sign in." };
  }
  redirect("/onboarding");
}

export async function resetRequestAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = field(formData, "email").trim();
  if (email) {
    const redirectTo = await resetRedirectTarget();
    // Enumeration-safe: the provider swallows every error, so this never reveals account state.
    await auth().requestPasswordReset({ email, redirectTo });
  }
  return { notice: "If that address has an account, a reset link is on its way." };
}

/**
 * Clears the active session and returns to /login (SCREEN-AUTH §3 — sign-out never deletes data).
 * A Server Action (not a route handler) so it uses the SAME cookie-flush path as login/signup:
 * the provider clears the session cookies via `next/headers`, then `redirect` navigates — the
 * Supabase-documented, reliable flush (a stale access-token cookie must never survive sign-out).
 * Under local-password / anonymous this is a harmless no-op that still lands on /login.
 */
export async function signOutAction(): Promise<void> {
  try {
    await auth().signOut();
  } catch {
    /* non-supabase providers may refuse; sign-out is best-effort */
  }
  redirect("/login");
}

export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");
  if (password.length < MIN_PASSWORD) {
    return { error: `Use a password of at least ${MIN_PASSWORD} characters.` };
  }
  if (password !== confirm) {
    return { error: "Those passwords do not match." };
  }
  try {
    await auth().updatePassword({ password });
  } catch {
    return { error: "That reset link has expired. Request a new one." };
  }
  // Clear the recovery session so it can't be reused; the user re-authenticates with the new
  // password. A signOut failure is non-fatal — the redirect still lands them on login.
  try {
    await auth().signOut();
  } catch {
    /* non-fatal */
  }
  redirect("/login?reset=1");
}
