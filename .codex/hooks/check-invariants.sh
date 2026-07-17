#!/usr/bin/env bash
# PostToolUse check — greps the working tree for locked-invariant violations after a write.
# Non-zero exit + a loud report signals the turn to self-correct before the human reviews.
set -uo pipefail
FAIL=0
note () { echo "  [invariant] $1"; FAIL=1; }

# Money must be integer paise — flag float-typed money fields / rupee floats.
grep -RInE '(amount|price|balance|spend|budget)[^;]*:\s*(number|float)' \
  --include='*.ts' --include='*.tsx' core data providers 2>/dev/null | grep -vi paise && \
  note "Money field typed as float/number — use integer PAISE (no floats for money)."

# No hardcoded hex in components (tokens-only UI).
grep -RInE '#[0-9a-fA-F]{6}' --include='*.tsx' components app 2>/dev/null | grep -vE '(tokens|theme|globals)\.' && \
  note "Hardcoded hex in a component — use a CSS variable (tokens-only UI)."

# No concrete runtime model imported in business logic (provider-blind core).
grep -RInE "from ['\"]@ai-sdk/(openai|google|anthropic)['\"]" --include='*.ts' core data 2>/dev/null && \
  note "Concrete AI-SDK provider imported in core — route through providers/llm tier gateway."

# Generic/blob persistence instead of typed per-domain writes.
grep -RInE 'repo\.create\(\s*\{[^}]*payload' --include='*.ts' core 2>/dev/null && \
  note "Looks like a generic 'payload' write — persist into a typed per-domain table only."

if [ "$FAIL" -eq 1 ]; then
  echo "check-invariants: VIOLATIONS FOUND — fix before this lands (AGENTS.md §2)."
  exit 1
fi
echo "check-invariants: clean."
