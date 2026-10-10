# DEVDAY-0 — "Sarthi inside ChatGPT" (MCP server + app panel) — executable plan

Branch `hack/devday-chatgpt` · worktree `/Users/satviksawhney/Downloads/sarthi/.claude/worktrees/main` · freeze 12:15 IST.
Brief: `scratchpad/devday-build-brief.md` (signed off). This plan expands it; it does not re-open it.

## 1. Goal + demo story
- The user tells ChatGPT about their day; ChatGPT fills Sarthi's typed `log_entries` args.
- **Sarthi's server decides what is safe to write**: literal numbers file; guessed numbers become cards in the Sarthi panel.
- Only a tap in the panel (`confirm_entry`, app-only) can file a card; `undo_last` reverses the last batch within 5 min.

## 2. Locked decisions (from brief, verbatim intent)
- ChatGPT fills tool args; no server-side LLM parse. Sarthi LLM calls = `createLlmGateway("fake")` on this branch (`LLM_PROVIDER=fake`); if a real model is ever enabled it is `gpt-6-luna` only.
- Server double-check `verifyAgainstText` (pure code) demotes any number not literally in the user's words → `estimated:true`, `confidenceBps ≤ 8999` → pending.
- Single user `local-dev`, SQLite `file:./sarthi.dev.db` (what `pnpm db:seed:dev` seeds), no auth.
- Standalone Node `http` MCP server on **8787** `/mcp`, `@modelcontextprotocol/sdk@1.32.1` + `@modelcontextprotocol/ext-apps@^1.7.5`, transport/CORS/resource wiring copied from the spike. Run with `tsx`.
- **No Redis, no queue — single process.** The panel holds pending cards (plus `window.openai.setWidgetState`); SQLite is the only store; a pending card lives nowhere on the server (it is just a `Proposal` echoed back on confirm, re-validated by `proposalSchema.parse`).
- Invariants: nothing estimated writes unconfirmed · integer units · typed writes via the existing commit service only · `core/` framework-clean · `pnpm check` green · no commits by lanes · no `docs/` edits.

## 3. Lane A — server (ordered)

### A1. `core/capture/verify.ts` (new, framework-clean: imports only `./contract` types)
```ts
export interface VerifyResult { proposal: Proposal; demotedReasons: string[] }
export function verifyAgainstText(proposal: Proposal, rawText: string): VerifyResult
export function numberAppearsInText(canonical: string, rawText: string): boolean  // exported for tests
```
- Tokenise `rawText` with `/\d+(?:[.,]\d+)*/g`, strip commas, normalise (`"1.50"→"1.5"`, `"340"→"340"`) into a `Set<string>`.
- Canonical display form per quantity, computed by **integer divmod only**: paise → `${r}` or `${r}.${pp}` (reuse the `formatPaise` divmod shape, no `₹`/grouping); grams → `${kg}` or `${kg}.${frac}` trimmed; everything else `String(int)`.
- Checked quantities (never promotes; untouched fields untouched): `transaction.amountPaise` · `meal.kcal` + non-null `proteinGrams/carbsGrams/fatGrams` · `water.millilitres` (null → skip; routing already pends it) · `workout.durationMinutes` + non-null `burnKcal` · `weighIn.weightGrams` · `skillSession.minutes` · `habitLog` → nothing.
- Any miss → `{ ...proposal, estimated:true, confidenceBps: Math.min(proposal.confidenceBps, 8999), why:{...why, assumptions:[...assumptions, reason]} }` with reason like `ChatGPT estimated 420 kcal — that number isn't in your words`.
- Export from `core/capture/index.ts`: `export * from "./verify";`.

### A2. `tests/verify.test.ts` (node:test + `assert/strict`, like `tests/route.test.ts`)
Canonical text `"Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design"`:
1. transaction 34000 paise → untouched (`estimated:false`, bps unchanged). Also `"₹340"`, `"340rs"`, `"1,000"`→100000 pass.
2. meal kcal 420 → demoted, reason mentions `420 kcal`; `routeProposal(result.proposal, new Set())` → `pending`.
3. skillSession 90 → untouched; routes `auto` (with bps 10000).
4. water 500 (model guessed) → demoted; water `null` → unchanged (no reason) but still `pending` via route.
5. workout 30 min stated + burnKcal 250 guessed → demoted with a burn reason; `"1.5 kg"` text keeps weighIn 1500 g.
6. Never promotes: an already-estimated proposal with a matching number stays `estimated:true`.
Wire: add `tests/verify.test.ts` to `test:capture` in `package.json`. Verify: `pnpm tsx --test tests/verify.test.ts`.

### A3. `mcp/tools.ts` — ModelEntry → Proposal mapper + tool handlers (no transport code)
- `modelEntrySchema` (zod 4, flat, every field `.describe()`d; the model reads these). `kind` enum = 7 proposal kinds. Server **ignores** fields foreign to the kind (pick per kind, never spread).
- Startup context (read once, refreshed per call is fine): `profile = await repos.profile.profiles.byId("local-dev")`; `timezone = isValidTimeZone(profile?.timezone ?? "") ? profile!.timezone : "UTC"` (same line as `app/(app)/today/page.tsx:26`); `localDate = localDateInZone(now, timezone)`.
- Put the **real entity names** in the tool description so the model picks existing ones (ask-don't-invent, no fuzzy matching): `repos.money.categories.list({})`, `repos.habits.habits.list({})` (non-archived), `repos.skills.skills.list({})`. Seed has `Food & dining`, `Transport`, `Rent`, `Salary`; `Meditate`, `No sugar`, `Water`, `Wake by 5:30 AM`; `System design`, `DSA`.
- `toProposal(entry, ctx): Proposal | { question }` — base: `proposalId: randomUUID()`, `intent:"create"`, `occurredAt: now`, `localDate`, `timezone`, `estimated: entry.estimated`, `confidenceBps: clampInt(entry.confidence*100, 0, 10000)`, `why:{basis:"ChatGPT tool call", assumptions:[]}`, `evidenceRefs: []`. Payloads:
  - transaction: `amountPaise = rupeesToPaise(String(entry.amountRupees))` (**takes a string**, returns `null` for ≤0 / >2 dp → emit a `Question` "amount unclear", no proposal); `direction ?? "expense"`, `categoryName = entry.category ?? "Food & dining"` is NOT allowed — missing category → Question. `merchant ?? null`, `note = label ?? null`.
  - meal: `kcal` required else Question; macros nullable; `items` map `quantity: Math.round`; `note = label`.
  - water: `millilitres ?? null` (null stays null — routes pending by design).
  - workout: `durationMinutes` required; `burnKcal ?? null`; `exercises: entry.exercise ? [{name, sets:null, reps:null, loadGrams:null}] : []`.
  - weighIn: `weightGrams = kilogramsToGrams(String(entry.weightKg))` (string in, null → Question).
  - habitLog: `habitName`, `status ?? "done"`; skillSession: `skillName`, `minutes` required.
- `log_entries({ text, entries })`:
  1. map → proposals/questions; 2. `verifyAgainstText(p, text)` each; 3. `routeProposal(p, EMPTY_BLOCKED)`; 4. auto → `resolveProposal(p, repos, "auto")` (ok → autoCommit; not ok → pending + its `question`, exactly like `prepareDraft`); pending → `Card`.
  5. if autoCommit.length: `service.commit({ idempotencyKey: sha256(text + JSON.stringify(entries)), kind:"capture", proposals: autoCommit })` (`node:crypto` `createHash`). `status:"replayed"` → message "already logged this exact message".
  6. `Card` from each pending: `valueLabel`/`value`/`unit` per kind (money via `formatPaise`; kg via grams divmod; water null → `valueLabel:"volume?"`, `value:null`), `reasons = [...routed.reasons, ...demotedReasons, ...resolveReason]`, `proposal` verbatim.
  7. return `{ filed, pending, questions, today: await buildToday(), lastCommitId, message }`.
- `confirm_entry({ proposal, value? })`: `proposalSchema.parse(proposal)`; if `value` given → `applyUserEdit(p, patch)` where patch is per kind (`amountPaise: rupeesToPaise(String(value))`, `kcal`, `millilitres`, `durationMinutes`, `weightGrams: kilogramsToGrams(String(value))`, `minutes` — all must be safe integers else error text); if no `value` and `water.millilitres===null` → honest error "enter a volume first". Then `resolveProposal(p, repos, "accepted")` (not ok → return its question, nothing written) → `service.commit({ idempotencyKey: p.proposalId, kind:"tap", proposals:[resolved] })` → `{ filed:[one], pending:[], confirmedCardId: p.proposalId, ... }`. Note: accepted card writes `estimated` as-is (true) unless edited — that is the existing F3 semantics; the user's tap is the confirmation.
- `undo_last({})`: there is **no "undo latest" API** — find the envelope: `latest = (await repos.commits.commits.list({})).filter(c => c.status==="committed").sort(createdAt desc)[0]`; none → message "nothing to undo"; else `service.undoLatest({ commitId: latest.id, now })`; catch `UndoNotAvailableError` → `message: error.message` (window expired / superseded), nothing pretended.
- `get_today({})` → `buildToday()`.

### A4. `mcp/today.ts` — `buildToday(repos, localDate): Promise<TodaySummary>` (reads only)
- health: filter `repos.health.meals/waterLogs/workouts .list({})` by `localDate`; `buildHealthView({meals, waterLogs, workouts, weighIns:[]})` → `kcalIn = rings[0].value`, `waterMl = rings[1].value`; `workoutMin = Σ durationMinutes` (HealthView has no minutes field — sum directly).
- money: `transactions.filter(t => t.localDate===localDate && t.direction==="debit")` → `spentPaise = Σ amountPaise`, `spentLabel = formatPaise(spentPaise)` (`core/domains/money.ts`).
- habits: `buildHabitsView({ localDate, habits, logs, rules, ruleTotals: await resolveRuleDayTotals(repos, rules, localDate) }).headline` → `{done,total}`.
- skills: `Σ minutes` of `repos.skills.sessions.list({})` with `localDate===today`.
- xp: `progress = repos.plans.progress.list({})`; `level = buildIdentity({progress, arcs}).level` (overall row); `total = Σ xp` over the four domain rows (commit awards per-domain XP, the `overall` row does not move on capture — summing is what makes XP visibly tick in the demo).

### A5. `mcp/server.ts` — transport (copy spike lines 56–77 verbatim, TS-typed)
- Composition: `const factory = createSqliteRepositoryFactory(process.env.DB_URL ?? "file:./sarthi.dev.db")` (from `data/repository`); `repos = factory.forUser({ userId:"local-dev", email:null, mode:"local" })`; `llm = createLlmGateway((process.env.LLM_PROVIDER as LlmProviderName) ?? "fake")`; `service = createCommitService({ repos, llm })` — **one** service instance (keeps the D-F single-flight lock meaningful).
- `panelHtml = readFileSync(new URL("./panel.html", import.meta.url), "utf8")` at startup; `registerAppResource(server, "sarthi-panel", "ui://sarthi/panel.html", {}, ...)` with `RESOURCE_MIME_TYPE`.
- `registerAppTool` ×4; `_meta`: `log_entries` `{ ui:{resourceUri}, "openai/ui":{entrypoints:[{type:"thread"}]} }`; `confirm_entry` `{ ui:{ resourceUri, visibility:["app"] } }`; `undo_last` `{ ui:{resourceUri} }`; `get_today` `{ ui:{resourceUri}, "openai/ui":{entrypoints:[{type:"global"},{type:"thread"}]} }` + `annotations:{readOnlyHint:true}`. `outputSchema` = zod shape of `SarthiState`.
- Build one `McpServer` per request like the spike (stateless transport); the repos/service are module singletons.

### A6. `package.json`
- deps: `"@modelcontextprotocol/sdk": "1.32.1"`, `"@modelcontextprotocol/ext-apps": "^1.7.5"`; script `"mcp:dev": "LLM_PROVIDER=fake tsx mcp/server.ts"`; `test:capture` += `tests/verify.test.ts`.
- If `eslint .`/`tsc` choke on `mcp/` (ESM `import.meta`, `.html` read): add `mcp/**` to tsconfig `include` only; do not touch core rules.

### A7. Smoke (`scratchpad/mcp-smoke.sh`, not committed)
```
H='-H content-type:application/json -H accept:application/json,text/event-stream'
curl -s localhost:8787/mcp $H -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'
curl -s localhost:8787/mcp $H -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'   # expect 4 tools, confirm_entry has visibility ["app"]
curl -s localhost:8787/mcp $H -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"log_entries","arguments":{"text":"Spent 340 on lunch, 2 rotis and dal, drank a bottle, 90 min of system design","entries":[{"kind":"transaction","estimated":false,"confidence":95,"amountRupees":340,"category":"Food & dining","label":"Lunch"},{"kind":"meal","estimated":true,"confidence":70,"kcal":420,"label":"2 rotis, dal","items":[{"name":"roti","quantity":2,"unit":"piece"},{"name":"dal","quantity":1,"unit":"bowl"}]},{"kind":"water","estimated":true,"confidence":60,"millilitres":500},{"kind":"skillSession","estimated":false,"confidence":95,"skillName":"System design","minutes":90}]}}}'
```
Expected: `filed` = transaction ₹340 + skillSession 90 min; `pending` = meal (reason: 420 not in words) + water (500 not in words); `questions:[]`; `today.money.spentLabel` includes 340; `lastCommitId` set. Then `undo_last` → both filed rows gone, `today` back. Then `confirm_entry` with the meal card's `proposal` → `filed:[meal]`, `confirmedCardId`.

## 4. Lane B — `mcp/panel.html` (ordered)
1. **Tokens** on `:root` (dark = Ember dark values from `app/globals.css` lines 96–120): `--bg-canvas:#0c0b0a; --bg-card:#17130e; --bg-raised:#1e1913; --line:#2a241c; --ink-1:#f4efe4; --ink-2:#a79e8e; --ink-3:#8d8377; --energy:#e8913e; --dom-health:#7fb08c; --dom-money:#c0883a; --dom-habits:#8189cf; --dom-skills:#a97fc9; --ok:#7fb08c; --warn:#e6972e; --danger:#c96e63; --ring:#f4efe4; --r-card:20px; --r-chip:999px; --r-input:14px; --t-fast:120ms; --t-base:200ms; --ease-standard:cubic-bezier(0.2,0,0,1); --space-2..6: 8/12/16/20/24px; --text-body:15px; --text-caption:12px; --text-display:28px`. `@media (prefers-color-scheme: light)` → Bone light values (lines 208–232: `#faf7f2 #ffffff #fdfcf9 #e5dfd6 #211e1c #6f6a66 #736d65 #c86f1b … --ok:#4c8a5e --warn:#a47417 --danger:#b0483c --ring:#211e1c`). Rules use only `var(--…)`; `--energy` only on the XP/level pill. `font-family: system-ui` (no external fonts).
2. **Layout** (single column, max-width 420px): header (`Sarthi` · `today.localDate` · XP/level pill) → `#needs-ok` section (cards: domain chip coloured by `--dom-*`, title, `valueLabel` at `--text-display`, reasons `--text-caption --ink-2`, buttons Keep / Edit / Discard) → `#filed` strip (+ one Undo button) → `#today` 2×2 tiles → `#questions` list → `#status` line (aria-live).
3. **Bridge** (copy spike lines 17–24): `req("ui/initialize", { appInfo:{name:"sarthi",version:"0.1.0"}, appCapabilities:{}, protocolVersion:"2026-01-26" })` → `notify("ui/notifications/initialized")`; on `ui/notifications/tool-result` → `apply(params.structuredContent)`; tool calls via `req("tools/call",{name,arguments})`. If no tool-result within 1.5 s of init → `tools/call get_today`.
4. **Merge rules** (`apply(state, source)`): `log_entries` → `pending = state.pending`, `filed = [...state.filed, ...filed]`; `confirm_entry` → drop `confirmedCardId` from pending, prepend `state.filed`; `undo_last`/`get_today` → pending untouched; every result sets `today`, `questions`, `lastCommitId`, `message`. Persist `{pending}` via `window.openai?.setWidgetState?.()`; restore from `window.openai?.widgetState?.pending` on load.
5. **Actions**: Keep → `confirm_entry {proposal}`; Edit → inline `<input type=number inputmode=numeric step=1>` + Keep → `confirm_entry {proposal, value}`; Discard → local remove only; Undo → `undo_last {}`. A water card with `value:null` opens in Edit mode (Keep disabled until a value is typed).
6. **States**: button in-flight (`disabled` + "…" label), error line under the card from `error.message`/`content[0].text` (never clears pending on failure), empty states ("Nothing needs your OK", "Nothing filed yet").
7. **A11y**: `<button>`s, `<label for>` on inputs, `:focus-visible` outline `var(--ring)`, `@media (prefers-reduced-motion: reduce){*{transition:none}}`.
8. **Verify** — `scratchpad/panel-harness.html` (~20 lines): an `<iframe src="../mcp/panel.html">`; `window.addEventListener("message")` replies to any `{id}` with `{jsonrpc:"2.0",id,result:{}}`; three buttons post `{jsonrpc:"2.0",method:"ui/notifications/tool-result",params:{structuredContent: FIXTURE}}` for (a) the canonical split (2 filed, 2 pending), (b) a confirm result, (c) an undo result. Open with `python3 -m http.server` from the worktree root; check 390px and 360px widths.

## 5. Integration (orchestrator)
1. `pnpm db:seed:dev` (populated; has `Food & dining`, `System design`).
2. `pnpm mcp:dev` → `[sarthi-mcp] listening http://localhost:8787/mcp`; run A7 smoke.
3. `cloudflared tunnel --url http://localhost:8787` → copy `https://….trycloudflare.com/mcp`.
4. ChatGPT → Settings → Apps/Connectors → edit the Sarthi connector URL → refresh; confirm `tools/list` shows 4 tools in the server log and the panel resource loads.
5. E2E: say the canonical sentence → ChatGPT calls `log_entries` → thread panel: 2 filed (₹340, 90 min), 2 cards (meal, water). Tap Keep on meal → filed, card gone, XP ticks. Ask "undo that" → `undo_last` → meal row gone, message says so. Open sidebar → `get_today` tiles.

## 6. Gates
- `pnpm check` green (typecheck, lint, core-boundary, all tests incl. `tests/verify.test.ts`).
- Canonical sentence via smoke: filed = {transaction 34000 paise, skillSession 90}; pending = {meal, water}; `questions: []`.
- `tools/list` shows `confirm_entry` with `_meta.ui.visibility:["app"]`; asking ChatGPT to "confirm the meal" does not file it (server log shows no `confirm_entry` from the model).
- `undo_last` removes the batch; a second `undo_last` returns an honest "nothing to undo" message.
- Panel harness: three fixtures render; Keep/Edit/Undo show in-flight + error states.

## 7. Risks + fallbacks
- ChatGPT Plus refuses write tools / panel → Codex CLI as client: `~/.codex/config.toml` `[mcp_servers.sarthi] url = "http://localhost:8787/mcp"`; demo the same beats in the terminal, panel via harness.
- Tunnel drops → restart `cloudflared`, paste new URL, refresh connector (budget 2 min; keep the harness open as backup).
- Model mangles `entries` → flatten: drop `items`, keep one number per kind; descriptions list exact category/habit/skill names.
- Unknown category/skill from the model → Question, nothing written (by design; say it out loud in the demo).
- Same sentence twice → idempotency replay ("already logged"); for a re-demo, run `undo_last` or reseed.
- `eslint .`/`tsc` picking up `mcp/` → scope tsconfig include; never weaken core rules. `verifyAgainstText` false demotion ("1.5 hours" → 90 min) → card, not a wrong write; acceptable.

## 8. Demo script (≤2 min, 6 beats)
1. "This is Sarthi inside ChatGPT. I just talk." — say the canonical sentence.
2. Panel: "₹340 and 90 minutes filed — those numbers were in my words."
3. "420 kcal and 500 ml are cards. ChatGPT guessed them; Sarthi's server caught that — pure code, no model."
4. Tap Keep on the meal → filed, XP ticks. "Only my tap can confirm. ChatGPT can't call that tool."
5. "Undo that" → gone. "Every write is undoable for 5 minutes."
6. Sidebar → Today tiles. "Four typed stores, one pipeline, built with Codex."
OpenAI tools used: ChatGPT Apps SDK (MCP + `ext-apps` panel resource, app-only tool visibility), ChatGPT's model filling typed tool args; Codex (Sol/Terra/Luna mesh) wrote the build.

## 9. Time plan (IST, actual)
- 11:15 sign-off → 11:15–11:45 A1–A2 (verify + tests) ‖ B1–B3 (tokens, layout, bridge)
- 11:45–12:10 A3–A6 (tools, today, server, deps) ‖ B4–B7 (merge, actions, states, a11y)
- 12:10–12:20 A7 smoke + B8 harness · 12:20–12:40 integration (swap spike→server on :8787, same tunnel, Refresh plugin, ChatGPT e2e)
- 12:40–12:50 `pnpm check`, commit, backup screen recording · 13:00 demo.
