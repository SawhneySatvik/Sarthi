"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resetRequestAction } from "@/app/(auth)/actions";

import { FormNotice, PendingSkeleton, SubmitButton, TextField } from "./fields";
import { EMPTY_AUTH_STATE } from "./types";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(resetRequestAction, EMPTY_AUTH_STATE);
  return (
    <form action={action} className="flex flex-col">
      <h1 className="font-display text-display text-ink-1">Reset your password</h1>
      <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
        Enter your email and we&apos;ll send a link to set a new password.
      </p>
      {/* Enumeration-safe: the same quiet confirmation shows whether or not the address exists. */}
      {state.notice ? <FormNotice>{state.notice}</FormNotice> : null}
      <div className="mt-6">
        <TextField id="email" name="email" label="Email" type="email" autoComplete="email" inputMode="email" autoFocus />
      </div>
      <SubmitButton pending={pending}>{pending ? "Sending…" : "Send reset link"}</SubmitButton>
      {pending ? <PendingSkeleton /> : null}
      <p className="mt-6 text-center font-ui text-caption text-ink-3">
        <Link href="/login" className="text-ink-1 underline focus-visible:ring-2 focus-visible:ring-ring">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
