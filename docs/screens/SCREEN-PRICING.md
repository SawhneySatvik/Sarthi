# docs/screens/SCREEN-PRICING.md — Pricing and Checkout Rail

| | |
|---|---|
| **Role** | The Phase-1 sellable rail: a clear annual price, a test-mode checkout, and visible proof that Pro flips—without gating the demo or free v1 experience. |
| **Provider** | Razorpay test mode in v1; the webhook and idempotency contract is frozen in `docs/architecture/ARCHITECTURE.md`. |
| **Price** | Pro annual: ₹499/year (`49900` paise). No monthly option in v1. |
| **Inherits** | `docs/experience/DESIGN.md` and the public-route patterns in `docs/screens/SCREEN-AUTH.md`. |

## 0. The one-sentence spec

Explain the complete free experience, offer one transparent annual Pro checkout, then visibly reflect the plan change while keeping every judge/demo path free.

## 1. Route and states

| Route/state | Content | Primary action |
|---|---|---|
| `/pricing` | One house-style hero, the 60-second loop, Free and Pro comparison, ₹499/year | `Go Pro` |
| Signed-out CTA | Preserve pricing context | `/signup?next=/pricing` |
| Signed-in free CTA | Checkout summary and Razorpay test checkout | `Continue to checkout` |
| Checkout success | “Pro is active” confirmation and visible Pro affordance | Return to Today |
| Checkout cancel/failure | Preserve free plan, state reason plainly | Return to pricing / retry |
| Cut-line fallback | Same pricing page and price | CTA becomes waitlist email capture |

- Free is explicitly described as the full v1 experience; Pro gates nothing in v1.
- The only visible Pro affordance is a plan badge/status row in Settings and the post-checkout confirmation. It must not hide or block F3/F11 paths.
- Legal links appear in the pricing footer and checkout handoff.

## 2. Checkout and plan contract

- Server creates the Razorpay checkout only for the repository-bound authenticated user and the fixed annual price (`49900` paise).
- Client success is never proof of payment. The verified provider webhook is the only path that changes `plan` from `free` to `pro`.
- Webhook processing is idempotent by provider event id, records its audit outcome, maps to the authenticated user, and never grants a plan from client-supplied identifiers.
- Failed, duplicate, delayed, or replayed webhooks leave the plan correct and observable. The precise table/transaction shape is an Architecture gate.

## 3. Judge/demo safety

- The authenticated D-033 demo seed remains free irrespective of plan state.
- A free user can run every demo flow before, during, and after visiting pricing.
- The payment-link/waitlist fallback changes only the CTA implementation; it does not change displayed price, Free access, or the later webhook contract.

## 4. Screenshot-verify checklist

Pricing hero · signed-out CTA · signed-in free state · checkout handoff · cancelled state · success/Pro state · waitlist fallback · Settings plan affordance — at 390px and desktop smoke, Ember Dark and Ember Light.
