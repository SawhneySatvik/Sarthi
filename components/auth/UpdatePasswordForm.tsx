"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "@/app/(auth)/actions";

import { FormError, PendingSkeleton, SubmitButton, TextField } from "./fields";
import { EMPTY_AUTH_STATE } from "./types";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, EMPTY_AUTH_STATE);
  return (
    <form action={action} className="flex flex-col">
      <h1 className="font-display text-display text-ink-1">Set a new password</h1>
      <p className="mt-2 font-coach text-body leading-[var(--leading-coach)] text-ink-2">
        Choose a new password for your account.
      </p>
      <div className="mt-6">
        <TextField
          id="password"
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          autoFocus
        />
        <TextField
          id="confirm"
          name="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          minLength={8}
        />
      </div>
      <p className="mt-2 font-ui text-caption text-ink-3">At least 8 characters.</p>
      {state.error ? <FormError>{state.error}</FormError> : null}
      <SubmitButton pending={pending}>{pending ? "Saving…" : "Save password"}</SubmitButton>
      {pending ? <PendingSkeleton /> : null}
    </form>
  );
}
