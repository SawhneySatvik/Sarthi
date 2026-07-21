"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signupAction } from "@/app/(auth)/actions";

import { FormError, FormNotice, PendingSkeleton, SubmitButton, TextField } from "./fields";
import { EMPTY_AUTH_STATE } from "./types";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, EMPTY_AUTH_STATE);
  return (
    <form action={action} className="flex flex-col">
      <h1 className="font-display text-display text-ink-1">Create your account</h1>
      <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
        One sentence a day. Four lives in order.
      </p>
      {state.notice ? <FormNotice>{state.notice}</FormNotice> : null}
      <div className="mt-6">
        <TextField id="email" name="email" label="Email" type="email" autoComplete="email" inputMode="email" autoFocus />
        <TextField
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
        />
      </div>
      <p className="mt-2 font-ui text-caption text-ink-3">At least 8 characters.</p>
      {state.error ? <FormError>{state.error}</FormError> : null}
      <SubmitButton pending={pending}>{pending ? "Creating…" : "Create account"}</SubmitButton>
      {pending ? <PendingSkeleton /> : null}
      <p className="mt-6 text-center font-ui text-caption text-ink-3">
        Already have an account?{" "}
        <Link href="/login" className="text-ink-1 underline focus-visible:ring-2 focus-visible:ring-ring">
          Sign in
        </Link>
      </p>
    </form>
  );
}
