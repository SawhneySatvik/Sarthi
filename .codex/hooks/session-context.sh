#!/usr/bin/env bash
# SessionStart — injects the current gate as a developer-message context so every session
# starts anchored on the definition-of-done, not a cold start.
set -euo pipefail
GATE="$(cat .codex/GOAL 2>/dev/null || echo 'Day-1 gate: FLOWS F3 end-to-end on the fake stack, keyless, with Health.')"
printf '{"contexts":["CURRENT GATE — %s  Invariants: nothing estimated writes unconfirmed; integer units; provider-blind keyless core; tokens-only UI; typed writes; no new domains."]}\n' "$GATE"
