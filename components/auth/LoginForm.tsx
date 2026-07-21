"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction } from "@/app/(auth)/actions";

import { FormError, FormNotice, PendingSkeleton, SubmitButton, TextField } from "./fields";
import { EMPTY_AUTH_STATE } from "./types";

export function LoginForm({ reset }: { reset?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, EMPTY_AUTH_STATE);
  return (
    <form action={action} className="flex flex-col">
      <h1 className="font-display text-display text-ink-1">Welcome back</h1>
      <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
        Sign in to pick up where you left off.
      </p>
      {reset ? <FormNotice>Your password was updated. Sign in with your new password.</FormNotice> : null}
      <div className="mt-6">
        <TextField id="email" name="email" label="Email" type="email" autoComplete="email" inputMode="email" autoFocus />
        <TextField id="password" name="password" label="Password" type="password" autoComplete="current-password" />
      </div>
      {state.error ? <FormError>{state.error}</FormError> : null}
      <SubmitButton pending={pending}>{pending ? "Signing in…" : "Sign in"}</SubmitButton>
      {pending ? <PendingSkeleton /> : null}
      <p className="mt-6 text-center font-ui text-caption text-ink-2">
        <Link href="/reset-password" className="underline focus-visible:ring-2 focus-visible:ring-ring">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-3 text-center font-ui text-caption text-ink-3">
        New here?{" "}
        <Link href="/signup" className="text-ink-1 underline focus-visible:ring-2 focus-visible:ring-ring">
          Create an account
        </Link>
      </p>
    </form>
  );
}
