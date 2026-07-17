# docs/screens/SCREEN-AUTH.md — Authentication

| | |
|---|---|
| **Role** | The production entry boundary for a real multi-user Sarthi. It remains outside the local fake-stack path. |
| **Provider** | Supabase Auth email/password + reset in production; `LocalPasswordAuthProvider` with `local-dev` identity in dev/CI. |
| **Inherits** | `docs/experience/DESIGN.md` tokens, type, accessibility, and calm-at-rest rules. |

## 0. The one-sentence spec

Sign up or sign in with email and password, recover access when needed, then land in the correct authenticated state without exposing a password gate in production.

## 1. Routes and transitions

| Route | State | Primary action | Successful destination |
|---|---|---|---|
| `/signup` | New user | Email + password → `Create account` | Onboarding A |
| `/login` | Returning user | Email + password → `Sign in` | Today |
| `/reset-password` | Recovery request | Email → `Send reset link` | Quiet sent confirmation |
| reset callback | New password | Password + confirmation → `Save password` | Login |

- Signup and login cross-link each other. Welcome’s `I have an account` points to `/login`.
- Each public auth route includes links to `/privacy` and `/terms`; neither link blocks conversion.
- No developer provider selector, seed gesture, or password-gate wording appears in production auth screens.

## 2. Visual and interaction rules

- One narrow, token-driven form column over a quiet painterly backdrop; no marketing carousel or dashboard chrome.
- Email uses normal keyboard validation. Password requirements and errors appear inline, not as toasts or modals.
- Pending state uses a two-line shimmer/skeleton treatment; retry leaves fields intact.
- Account-enumeration-safe reset confirmation always says that a reset link was sent if the address is eligible.
- Inputs and primary actions meet the 44px target; full keyboard path and password-manager support are required.

## 3. Authenticated outcomes

- New accounts always enter onboarding first. After onboarding confirmation, show the optional `Try the 12-day demo` choice from D-033.
- Existing accounts with completed onboarding go directly to Today; incomplete onboarding resumes at its saved step.
- Sign out clears the active session and returns to `/login`; it does not delete local or server data.
- Dev/CI use the local password gate and fixed `local-dev` identity, never Supabase; its success destination follows the same onboarding/Today logic.

## 4. Data and safety contract

- `AuthProvider` alone resolves the authenticated `userId` and binds all repositories for the request/session.
- Auth forms never accept, render, or infer another user’s identifier; redirect targets are allowlisted local routes.
- Passwords and reset tokens are handled only by the active auth provider and never enter domain stores, logs, seed data, or capture drafts.
- The full provider and repository interfaces are frozen in `docs/architecture/ARCHITECTURE.md` before production code.

## 5. Screenshot-verify checklist

Signup · login · inline invalid-credential state · reset request · reset-sent confirmation · password-save state · completed-onboarding redirect · incomplete-onboarding resume — at 390px and desktop smoke, Ember Dark and Ember Light.
