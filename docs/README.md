# Sarthi Documentation

This directory is organized by the decision each document supports. The root stays intentionally small: this index, the category directories, and the Phase-2 `roadmap/`.

## Canonical read paths

1. Start with the repository-root `AGENTS.md` for invariants, gates, and agent ownership.
2. Read `docs/product/PROJECT.md` for orientation, then `docs/product/PHASES.md` for the current work order and cut lines.
3. Read `docs/architecture/TECH-STACK.md` before planning providers, storage, capture, auth, or eval work.
4. Read `docs/experience/FLOWS.md` plus the relevant `docs/screens/SCREEN-*.md` before building a journey or UI state.
5. Treat `docs/product/DECISIONS.md` as append-only authority; `docs/product/CHANGELOG.md` and `docs/operations/HANDOFF.md` record current execution state.

## Directory map

| Directory | Contents | Use it for |
|---|---|---|
| `product/` | Product brief, PRD, phase plan, decisions, critique, changelog | Scope, locked decisions, deadlines, and provenance |
| `architecture/` | Stack and signed architecture blueprint | Interfaces, schemas, provider contracts, and eval design |
| `experience/` | Design law, flows, art system, prototype prompts, refinements | UX behavior, visual rules, and F3/F11 journeys |
| `screens/` | Screen contracts, including auth and pricing | Per-screen state/data/verification work |
| `planning/` | Planning brief and ticket map | Phase decomposition and approved build sequence |
| `operations/` | Codex setup and session handoff | Harness setup and session continuity |
| `roadmap/` | Post-submission Phase-2+ specs | Deferred research and future work only |

## Authority rules

- `product/DECISIONS.md` overrides older prose when they conflict.
- `product/PHASES.md` and `planning/TICKETS.md` are the only live implementation order and acceptance gates.
- `architecture/ARCHITECTURE.md` and `planning/TICKETS.md` become authoritative once signed; until then, `architecture/TECH-STACK.md` is the implementation sketch.
- `screens/` contracts inherit `experience/DESIGN.md`; `experience/FLOWS.md` is the integration-test narrative.
