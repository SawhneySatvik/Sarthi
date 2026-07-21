"use client";

/*
 * components/auth/fields.tsx — token-only primitives shared by every auth form. 44px+ targets
 * (min-h-12 = 48px), full keyboard path, password-manager friendly (real name/autoComplete on
 * every input), and NO amber (auth is not earned). All colour/radius/motion via CSS-variable
 * utilities — no hardcoded hex/radius/duration.
 */

export function TextField({
  id,
  name,
  label,
  type,
  autoComplete,
  autoFocus,
  minLength,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  autoFocus?: boolean;
  minLength?: number;
  inputMode?: "email";
}) {
  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="font-ui text-caption text-ink-2">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        minLength={minLength}
        inputMode={inputMode}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="mt-2 min-h-12 w-full rounded-input border border-line bg-canvas px-3 font-ui text-body text-ink-1 placeholder:text-ink-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-6 min-h-12 w-full rounded-chip bg-ink-1 px-4 font-ui text-body text-canvas transition-colors duration-[var(--t-base)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-4 font-ui text-caption text-danger">
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mt-4 rounded-card border border-line bg-card p-4 font-coach text-body leading-[var(--leading-coach)] text-ink-2"
    >
      {children}
    </p>
  );
}

/** Two-line shimmer while a submission is in flight (SCREEN-AUTH §2 pending treatment). */
export function PendingSkeleton() {
  return (
    <div className="mt-4 space-y-2" aria-hidden>
      <div className="h-3 w-2/3 animate-pulse rounded-full bg-raised" />
      <div className="h-3 w-1/2 animate-pulse rounded-full bg-raised" />
    </div>
  );
}
