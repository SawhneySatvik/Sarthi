# Sarthi build harness — D-028 mesh: Sol plans + reviews · Terra writes ALL code · Luna read-only.
# Profiles pin models per task (immune to subagent-routing regressions).
#
#   make plan   T="capture pipeline: parse_dump -> route-by-confidence"
#   make build  T="implement providers/llm tier gateway + fake stack"     (Terra high — moat)
#   make screens T="build Today per docs/screens/SCREEN-TODAY.md P2 acceptance list"   (Terra medium — routine UI)
#   make ship   T="slice 1.2: Supabase Auth + userId scoping"             (Terra high — sellable wrap)
#   make deep   T="<the ticket Terra failed twice>"                        (Sol — escalation valve)
#   make review                      # diff review (Sol, read-only)
#   make phase-review P=1            # formal phase gate (Sol) per docs/product/PHASES.md
#   make research A="mobile bake-off per docs/planning/PLANNING-BRIEF.md §1"            (Sol, read-only+web)
#   make scout  Q="where does route-by-confidence decide auto vs card?"   (Luna)
#   make f3 | make verify S=today | make eval | make handoff | make doctor

.PHONY: plan build screens ship deep review phase-review research scout f3 verify eval handoff doctor gate

# --- PLAN (Sol, read-only): architect writes .codex/plan.md, then STOP for human sign-off ---
plan:
	codex exec --profile review "Act as the architect agent (.codex/agents/architect.toml). \
	Plan this ticket and write .codex/plan.md, then output PLAN_COMPLETE and stop: $(T)"

# --- BUILD (Terra high): the moat + anything hard. Requires an approved plan. ---
build:
	codex --profile build "Act as the pipeline agent (.codex/agents/pipeline.toml). \
	Follow the approved .codex/plan.md and AGENTS.md invariants. Task: $(T)"

# --- SCREENS (Terra medium): routine, well-specified UI ---
screens:
	codex --profile screens "Act as the screens agent (.codex/agents/screens.toml). \
	Follow the named SCREEN-*.md + docs/experience/DESIGN.md. Task: $(T)"

# --- SHIP (Terra high): Phase-1 sellable wrap — deploy/auth/billing/landing ---
ship:
	codex --profile build "Act as the ship agent (.codex/agents/ship.toml). \
	Follow docs/product/PHASES.md Phase 1 and the approved .codex/plan.md. Task: $(T)"

# --- DEEP (Sol): escalation valve — only after Terra fails the same ticket twice ---
deep:
	codex --profile deep "Escalated ticket (Terra failed twice — read its ESCALATE_TO_DEEP report first). \
	Follow the approved .codex/plan.md and AGENTS.md invariants. Task: $(T)"

# --- REVIEW the current diff (Sol, read-only, adversarial) ---
review:
	codex exec --profile review "Act as the reviewer agent (.codex/agents/reviewer.toml), diff mode. \
	Review the current git diff against AGENTS.md §2 invariants. findings + severity + gate_pass. No edits."

# --- PHASE REVIEW (Sol): the formal end-of-phase gate ---
phase-review:
	codex exec --profile review "Act as the reviewer agent (.codex/agents/reviewer.toml), PHASE-REVIEW mode. \
	Audit Phase $(P) against docs/product/PHASES.md: every slice DoD, every gate, cut-lines honored, docs/product/DECISIONS.md \
	current. gate_pass boolean decides whether the phase counts as done."

# --- RESEARCH (Sol, read-only + web): decision-grade product research ---
research:
	codex exec --profile review "Act as the product-researcher agent (.codex/agents/product-researcher.toml). \
	Agenda item: $(A). Output the matrix + recommendation + D-0XX draft to docs/roadmap/."

# --- SCOUT (Luna, read-only, fast/cheap exploration) ---
scout:
	codex exec --profile scout "Act as the scout agent (.codex/agents/scout.toml). Trace and map: $(Q)"

# --- F3 GATE (fake stack, keyless) ---
f3 gate:
	LLM_PROVIDER=fake VOICE_PROVIDER=fake codex exec --profile build "/f3-gate"

# --- SCREENSHOT-VERIFY a screen ---
verify:
	codex exec --profile screens "/verify-screen $(S)"

# --- EVAL run (Luna, unattended CI profile) ---
eval:
	codex exec --profile ci "Act as test-eval (.codex/agents/test-eval.toml). Run the eval harness on the \
	fake stack over the fixture dumps; output the A/B report. Fail if any wrong SILENT write occurred."

# --- HANDOFF ---
handoff:
	codex exec --profile scout "/handoff"

# --- ENV HEALTHCHECK ---
doctor:
	codex doctor --summary && codex features list && codex mcp list
