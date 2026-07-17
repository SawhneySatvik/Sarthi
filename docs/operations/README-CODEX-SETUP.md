# Codex environment setup — Sarthi

Everything here is the **build layer** (Codex + GPT-5.6 writing the code). The app's **runtime** models
are configured separately in `.env` (see `.env.example`). Never conflate the two (AGENTS.md §1).

## 0. Prereqs
- Node ≥ 20, pnpm, git. A ChatGPT plan with Codex access (Plus+ for `ultra`/subagents) OR an OpenAI API key.
- Install/upgrade the CLI, then confirm the version — the subagent + GPT-5.6 behavior below assumes a
  post-`v0.143` build (Bedrock GPT-5.6 + MCP tool-search era). Codex is experimental and moves fast; pin it.

```bash
npm i -g @openai/codex        # or: brew install codex
codex --version
codex login                   # ChatGPT sign-in (plan credits) or set OPENAI_API_KEY for per-token billing
```

## 1. Drop these files into the repo root
```
AGENTS.md            # the contract Codex reads first
.codex/config.toml   # project behavior, safety, features, subagent-routing fix, hooks, MCP
.codex/agents/*.toml # the 7 specialized agents, each pinned to a model
.codex/prompts/*.md  # custom slash commands: /f3-gate /verify-screen /handoff /codex-moment
.codex/hooks/*.sh    # HITL gates (PreToolUse deny, PostToolUse invariant check, SessionStart context)
docs/                # the whole build contract (AGENTS.md @-mentions these)
Makefile             # the profile-pinned orchestration harness
.env.example         # runtime (app) env — copy to .env
```

## 2. Install the global profiles (guaranteed per-model control)
Project-local config can't set `model_provider`/profiles, so these live in `~/.codex/`:
```bash
# base global config: provider + auth once
grep -q 'model_provider' ~/.codex/config.toml 2>/dev/null || \
  printf 'model_provider = "openai"\n' >> ~/.codex/config.toml
# copy the per-task profiles
cp profiles/*.config.toml ~/.codex/
# sanity
codex doctor --summary && codex features list
```
Profile → model map (D-028 mesh): `review` = **Sol** read-only (plans + reviews + research) ·
`build` / `screens` = **Terra** (writes ALL code; high vs medium effort) · `deep` = **Sol** write
(escalation valve — only after Terra fails the same ticket twice) · `scout` / `ci` = **Luna** (read-only).

The standing loop for every ticket:
`make plan T=…` → human signs off `.codex/plan.md` → `make build|screens|ship T=…` → `make review` →
land. Every phase ends with `make phase-review P=N` (Sol, against docs/product/PHASES.md) before it counts.

## 2b. Credit-budget posture (ChatGPT plan + ~Rs 4000 credits)
The budget is modest, so discipline matters — Luna-as-default is the right call:
- **Default to Luna** for the bulk (`make screens/scout/eval`); reserve **Sol** for `build` (pipeline/tough UI),
  `plan`, and `review`. Sol input/output costs ~5x Luna, so every Sol turn should earn it.
- **Dial reasoning effort down** (`medium`, not `high`) on routine turns — the config default is already medium.
  `xhigh`/`high` can burn 3–5x the tokens; use only when genuinely stuck (Alt+. to raise mid-session).
- **Watch burn** with `/usage` and `/status`; **`/compact`** to trim a bloated context before it inflates cost.
- Plan credits use rolling 5-hour windows — batch heavy Sol work rather than trickling it.
- The `fake` stack is keyless for the *app's* runtime, but does not save *Codex* credits — the levers above do.

## 3. Trust the project (required for `.codex/agents` + hooks to load)
Untrusted projects skip the `.codex/` layer. On first run Codex asks; accept, or set the project trusted.

## 4. The subagent caveat (read this once)
As of the 2026-07-09 GPT-5.6 drop, a **Sol** session auto-selects *MultiAgent V2*, which hides the
per-subagent `model`/`reasoning`/`service_tier` fields — so spawned subagents silently inherit **Sol**
and your `.codex/agents/*.toml` models are ignored. `.codex/config.toml` includes the workaround:
```toml
[features.multi_agent_v2]
hide_spawn_agent_metadata = false
tool_namespace = "agents"
```
Re-verify after every `codex upgrade` (tracking: openai/codex#31814). **The Makefile harness does not
depend on this** — each `make` target pins its model via `--profile`, so you always get the intended
model even if subagent routing regresses. Prefer the harness for anything money-critical.

## 5. First moves (first build gate)
```bash
make doctor        # env healthcheck
codex              # open the Sol session in the repo root, then type:  /kickoff
#   → runs the staged protocol: Stage 0 env+session-ID → Stage 1 doc critique (STOP) →
#     Stage 2 discuss+finalize (STOP) → Stage 3 architecture (STOP) → Stage 4 tickets (STOP) → Stage 5 build.
#   Raise effort to high (Alt+.) for stages 1 & 3; keep medium elsewhere to protect credits.

# The make targets below remain the per-ticket harness once Stage 5 starts:
make plan  T="scaffold: Next.js+TS+Tailwind+Drizzle+shadcn, token layer + Ember/Bone/Moss shell"
#   → review .codex/plan.md, sign off
make build T="execute the approved scaffold plan"
make plan  T="provider layer: LLM tier gateway + VoiceProvider + vision + the fake stack (keyless)"
make build T="..."   # provider layer
make build T="typed schemas + repository impl (SQLite) for all four domains"
make build T="capture pipeline: parse_dump -> route-by-confidence -> commit+undo -> XP; Health store+lens; capture sheet"
make f3                                        # the first build gate, keyless
make review                                    # adversarial pass before it lands
make handoff                                   # session-end handoff + CHANGELOG
```
Record the `/feedback` session ID from this first build session — the rubric needs it.
