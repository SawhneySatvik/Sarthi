#!/usr/bin/env bash
# PreToolUse gate — the primary policy enforcement point.
# Codex pipes a JSON event on stdin: { tool_name, command, cwd, session_id, ... }
# We DENY dangerous or scope-breaking commands before they run, else allow.
# Emit: {"decision":"deny","reason":"..."}  or  {"decision":"allow"}
set -euo pipefail
EVENT="$(cat)"
# Extract the command string (python3 is present in the sandbox; fall back to raw event text).
CMD="$(printf '%s' "$EVENT" | python3 -c 'import sys,json;
try: print(json.load(sys.stdin).get("command",""))
except Exception: print("")' 2>/dev/null || printf '%s' "$EVENT")"

deny () { printf '{"decision":"deny","reason":"%s"}\n' "$1"; exit 0; }

# 1. Never destroy the tree or reach outside the workspace.
printf '%s' "$CMD" | grep -Eq 'rm[[:space:]]+-rf[[:space:]]+(/|~|\$HOME|\.\.)' && \
  deny "Refusing recursive delete outside the workspace. Ask the human."
# 2. No force-push / history rewrite on shared branches.
printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+push.*(--force|-f)|git[[:space:]]+push.*(main|master)' && \
  deny "Push to main / force-push needs human sign-off (provenance + git custody)."
# 3. Schema migrations are a human decision (no new domain concepts mid-build).
printf '%s' "$CMD" | grep -Eq 'drizzle-kit[[:space:]]+(generate|migrate|push)' && \
  deny "DB migration touches the typed stores. Get sign-off, then run with --confirm-migration."
# 3b. Production deploys are a human gate (Phase-1 ships deliberately, not accidentally).
printf '%s' "$CMD" | grep -Eq 'vercel[[:space:]]+(--prod|deploy[[:space:]]+--prod)|supabase[[:space:]]+db[[:space:]]+push' && \
  deny "Production deploy/db-push needs human sign-off (Phase-1 gate)."
# 4. Don't let a build accidentally require real keys (keyless-fake-stack invariant).
printf '%s' "$CMD" | grep -Eq '(OPENAI_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY)=' && \
  deny "Inlining a real API key breaks the keyless fake-stack invariant. Use .env + LLM_PROVIDER=fake."

printf '{"decision":"allow"}\n'
