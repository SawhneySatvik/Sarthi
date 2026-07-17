# SAR-002 — Provider Ports and Deterministic Fake Stack

| | |
|---|---|
| **Status** | Accepted after final gate review on 2026-07-17 |
| **Owner** | `pipeline` (Terra) |
| **Depends on** | `SAR-001` — accepted |
| **Authority** | `AGENTS.md` §§1–2 · `docs/architecture/ARCHITECTURE.md` §§2, 2.1, 9 · `docs/architecture/TECH-STACK.md` §§1, 3 · `docs/planning/TICKETS.md` SAR-002 |
| **Out of scope** | Drizzle schemas/repositories/auth implementations, the `CaptureDraft` Zod contract or route/commit behavior, API routes, screens, deploy, billing, and live-provider network tests. |

## Goal

Create the provider-blind contracts and composition-ready adapters required for the keyless fake stack. The core may depend only on the contracts; providers own all AI SDK imports and every real-provider choice. The fake implementations must deterministically exercise later F3 fixtures without keys or network access.

## Current state

- `SAR-001` provides the App Router scaffold, AST-enforced `core/` boundary, and the server-only typed selector parser in `app/lib/runtime.ts`.
- The locked runtime defaults remain fake LLM/voice/vision, local-password auth, SQLite, waitlist billing, and judge mode off.
- The verified model IDs are the only allowed real entries: Google `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`; OpenAI `gpt-5.6-sol`/`gpt-5.6`, `gpt-5.6-terra`, `gpt-5.6-luna`. Anthropic has no enabled model ID.

## Resolved package alignment

D-036 selects the coherent AI SDK 7 set: `ai@7.0.28`, `@ai-sdk/google@4.0.16`, `@ai-sdk/openai@4.0.15`, and `@ai-sdk/anthropic@4.0.15`. It replaces the incompatible OpenAI 2.x package pin without changing a runtime model ID or the provider-blind port.

## Implementation steps

1. **Move portable provider contracts into `core/contracts/`**
   - Define the exact signed `Tier`, provider-name unions, `ImageInput`, `VoiceAudio`, `Transcription`, `ObjectRequest`, `ObjectResult`, `TextRequest`, `LlmGateway`, `VoiceProvider`, and `VisionProvider` TypeScript contracts from Architecture §2.1.
   - Re-export the contracts through the existing `core/contracts` barrel. These files may import Zod types only; they must not import `app/`, Next.js, React, Drizzle, AI SDK packages, or any `providers/` implementation.
   - Refactor `app/lib/runtime.ts` to import the provider-name types from `core/contracts` rather than duplicating them. It remains the server-owned parser and continues to own the runtime selector values.

2. **Install and pin only the verified AI SDK layer**
   - Add exactly `ai@7.0.28`, `@ai-sdk/google@4.0.16`, `@ai-sdk/openai@4.0.15`, and `@ai-sdk/anthropic@4.0.15`, then update `pnpm-lock.yaml` with the same exact resolved set.
   - Do not add an Anthropic model ID, quota, cost, API key, or live call. If installation reports a conflict against this D-036 set, stop and report it rather than loosening a pin.
   - Keep all AI SDK imports under `providers/`; `pnpm check:core-boundary` must remain clean.

3. **Implement the LLM matrix and adapter factory**
   - Create a single immutable `(provider, tier) → model ID` registry under `providers/llm/`. It exposes every verified Google/OpenAI ID, exposes deterministic fake IDs for all tiers, and represents Anthropic as explicitly disabled (not a guessed or fallback model).
   - Implement an AI-SDK-backed `LlmGateway` adapter for Google/OpenAI using `generateObject` and `generateText`. It must preserve tier, Zod schema validation, telemetry operation, optional binary image inputs, model/provider ID, integer token usage fields, and latency; it must never be imported from `core/`.
   - Make resolution explicit: `fake` creates the deterministic gateway; Google/OpenAI select only their signed matrix row; `anthropic` returns a clear disabled-configuration error. No unsupported provider may silently fall back to fake or another live provider.

4. **Implement fake adapters and versioned fixtures**
   - Add `providers/fake/` fixtures with explicit fixture/version identifiers for: the canonical cross-domain dump, an estimated meal-photo result, a receipt batch result, a canned coach line, and a deterministic brief.
   - The canonical fixture mirrors the frozen capture data shape from Architecture §5 only as inert fixture data. Do not create the CaptureDraft Zod schema, route-by-confidence logic, persistence, XP, or any capture service in this ticket.
   - `FakeLlmGateway` selects the deterministic object/text fixture solely from the port telemetry and validates its object output through the caller-supplied Zod schema. It reads no environment variable, key, clock, filesystem state, or network.
   - `FakeVoiceProvider.transcribe` returns the canonical transcript with stable confidence/language values for supported fixture audio; no browser/Web Speech or real STT adapter lands here.
   - `FakeVisionProvider.analyze` deterministically selects the meal or receipt fixture, validates it with the caller schema, and reports fake provider/model/usage/latency metadata. No real vision call lands here.

5. **Add composition-ready provider factories without scope creep**
   - Add provider-layer factories that take already-parsed selector names and return the correct LLM/voice/vision port. They must not import `app/lib/runtime.ts`, mutate environment state, or know authentication/database selectors.
   - Fake is fully callable. Non-fake voice/vision selections must fail clearly as not yet implemented rather than silently invoke fake or a network service; subsequent tickets can add real adapter behavior behind the unchanged ports.
   - Keep all real API keys confined to future concrete provider adapters. No provider module logs prompts, image bytes, transcripts, or credential values.

6. **Prove deterministic, keyless behavior**
   - Add TypeScript tests (and the minimal pinned test runner support if needed) for all matrix rows, exact model IDs, disabled Anthropic, factory selection, stable fake transcription, meal/receipt analysis, canned LLM object/text responses, schema validation failures, and repeatable metadata.
   - Test with API-key environment variables unset and with a network/fetch sentinel that fails if invoked; all fake-stack tests must pass without network access.
   - Add `test:providers` and include it in `pnpm test`/`pnpm check`. Keep the existing core-boundary tests unchanged and passing.
   - Validate with `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, and `.codex/hooks/check-invariants.sh`. Add a truthful changelog/provenance entry only after the acceptance evidence exists.

## Acceptance checklist

- [x] Signed LLM/voice/vision ports live in `core/contracts` and no provider import enters `core/`.
- [x] The immutable matrix exposes only the verified Google/OpenAI IDs; fake supports every tier; Anthropic is wired but disabled without a guessed ID.
- [x] Google/OpenAI AI-SDK adapters compile behind the port; the fake LLM/voice/vision adapters run deterministically and keylessly.
- [x] Versioned canonical capture, coach, meal, and receipt fixtures are present and testable without implementing capture behavior.
- [x] Fake stack has no network/API-key dependency; tests prove stable transcript and meal/receipt outputs.
- [x] `pnpm check`, `pnpm build`, frozen installation, and the invariant hook pass.

## Handoff to Terra

Implement only this provider/fake-stack boundary. You are not alone in the repository: preserve the accepted scaffold and concurrent changes; never revert unrelated files. Do not implement a schema, repository, local-password auth, capture router/commit path, UI, endpoint, or deployment feature. Report every changed file, validation command/output, the resolved `ai` core version, and any blocked acceptance item for Sol's diff review.
