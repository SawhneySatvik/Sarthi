/**
 * Shared `useActionState` shape for the auth forms. Lives in a plain module (NOT the
 * `"use server"` actions file, which may only export async functions, and NOT a `"use client"`
 * file) so both the server actions and the client forms can import the type.
 */
export type AuthActionState = {
  /** Inline, field-level failure (e.g. invalid credentials). */
  error?: string;
  /** Quiet, enumeration-safe confirmation (reset sent, or "check your email"). */
  notice?: string;
};

export const EMPTY_AUTH_STATE: AuthActionState = {};
