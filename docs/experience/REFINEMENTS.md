# docs/experience/REFINEMENTS.md — Prototype Review → Fix Pass

| | |
|---|---|
| **Source** | Depth review of the first Claude Design pass (2026-07-16 screenshots + shell HTML) |
| **Verdict** | Strong first pass — token discipline verified in code (900+ semantic refs, hexes confined to theme blocks), type trio loaded, D-018 rings correct. Fixes below, not rework. |
| **Companions** | D-023 Bone · D-024 Orb · D-025 de-slop laws (in `docs/product/DECISIONS.md`) |

---

## 1. BLOCKERS (fix in the prototype — it's the visual target)

### B1 — Light-mode scene scrim missing (Today header) — top priority
Amber cluster is illegible over the light gradient scene. **Fix prompt:**
```
On Today's header scene, apply the scrim recipe from docs/experience/DESIGN.md §8 in BOTH modes:
dark = linear-gradient(transparent 30%, var(--bg-canvas) 100%) bottom-weighted;
light = same geometry with the solid stop at 55% PLUS a 12% dark overlay across
the whole image. The date + "Day 12 of 33 · 🔥6 · ◇L4" cluster must pass AA over
the scene in Ember Light. Also merge the redundant "Today" tab title INTO the
scene header (title over the scrim, top-left) — one header, not two stacked.
```

### B2 — Weekly brief card renders as an empty gradient
The painterly band consumed the card. **Fix prompt:**
```
In Coach, the THIS WEEK card's painterly band is a 48px strip at the TOP of the
card only (border-radius top corners, grain overlay). Below it, inside the same
card: four domain trend lines each with a 40px inline sparkline, the pull-quote
observation in Fraunces, one adjustment chip, and the ink-3 evidence footer
"Day 8–14 · based on 43 entries". The band never exceeds 48px.
```

### B3 — Visible scrollbar under the domain chips
```
Hide the horizontal scrollbar on the Today domain-chip row (scrollbar-width:
none; ::-webkit-scrollbar { display:none }) while keeping touch/drag scroll.
Apply the same to every horizontal scroller (recurring shelf, seed chips).
```

## 2. THE ORB (capture hero upgrade — D-024)

Full spec now in `docs/screens/SCREEN-CAPTURE.md` §2. **Prototype prompt (2D approximation is fine in Claude Design; the true shader ships in Codex):**
```
Replace the capture sheet's hero mic with the CAPTURE ORB: a ~140px sphere of
~3000 particles on a <canvas>. Particles sit on a sphere surface, displaced by
layered simplex/Perlin noise. IDLE: amplitude 0.06, slow drift, particles in
var(--ink-2) at 45% alpha, faint var(--ink-1) core — it breathes, it does not
perform. HELD (hold-to-talk): ramp amplitude 0.06→0.35 and noise speed with a
simulated audio envelope (in the real build this is a Web Audio analyser);
particles brighten to var(--ink-1) with soft bloom. NEVER amber. RELEASE: orb
contracts, settles into a slow rotation, then collapses upward into the pinned
quote as the shimmer state takes over. Reduced-motion fallback: static layered-
gradient orb with a 1.03-scale pulse. The persistent capture BAR keeps a small
static orb glyph (gradient + grain), not a live canvas.
```
Build notes for Codex: Three.js `Points`, icosphere 4–6k verts, vertex shader with `uTime/uAmp/uSpeed`, additive blending, DPR ≤ 2, `getUserMedia` → `AnalyserNode` (RMS → uAmp, low-band energy → uSpeed), render loop paused when sheet closed. Battery/`prefers-reduced-motion`/no-WebGL → static fallback. Perf gate: 60fps on a mid-tier phone or particle count halves.

## 3. DE-SLOP PASS (taste upgrades, per screen — D-025)

| Screen | Generic tell | Upgrade |
|---|---|---|
| **All tabs** | Big-bold-title + avatar chrome on every tab reads stock | Today: title merges into scene (B1). Other tabs: keep, but title in Display with a one-line ink-3 context under it (Stats already has the toggle — good) |
| **Journey** | Disconnected dots; `meal photo` mono dev-tag; "2 photos" bad wrap | Continuous 2px `--line` rail behind the nodes (brightening through milestone diamonds); dev-tag → small camera glyph bottom-right; collapse row is one line with the chevron |
| **Viewer** | Journey bleeds through; caption collides with arrows | Backdrop to 92% `--bg-canvas`; caption block bottom-anchored, arrows vertically centered on the image only |
| **Placeholders** | Naked gradients read empty/AI-ish | Every gradient placeholder gets the grain overlay token + a 1px inner `--line` hairline — placeholders must look designed, not pending |
| **Stats cards** | Flat dark tints — missing the collectible feel | Add the domain radial sheen (8–12% from top edge) + grain; verify the rotateY flip on toggle |
| **Coach history** | Would default to stacked cards | Hairline-divided rows (`border-b --line` at 60%), no nested cards — the aa-bot law, now global |
| **Header cluster** | `Day 12 of 33·` stray middot; droplet glyph for streak | Normalize separators to ` · ` with even spacing; streak icon = lucide `flame` at 1.5px, amber number only |
| **Tools** | Verify `soon` pip color | Pip is `--ink-3` on all cards including honey Afford-it (never warm-tinted) |
| **Chips** | Stock pill look | Tighten: 13px medium label, 10px vertical padding, active fill uses the domain hue with `-strong` text on light; pending dot 4px `--ink-3` |
| **Motion (all)** | Static states read slop | Apply DESIGN §5: strip tick-ins 40ms stagger, Done check-draw, chip crossfades — the choreography is half the premium |

## 4. Bone rollout (D-023)
Prototype prompt:
```
Replace the Slate theme with BONE (editorial minimalist): light — canvas
#FAF7F2, card #FFFFFF, raised #FDFCF9, line #E5DFD6, ink1 #211E1C, ink2
#6F6A66; dark — canvas #131211, card #181614, raised #201D1A, line #302D2A,
ink1 #F4F1EC, ink2 #A3A09B. Add token --elev-card: Bone sets it to none (cards
lift via the 1px line at full strength); Ember and Moss keep the existing soft
shadow. Domain hues, amber, fonts, and art rules are unchanged. Update the
theme pill/switcher to Ember · Bone · Moss.
```

## 5. DO NOT TOUCH (the wins)
Coach reading room (light) · Skills drill counter hierarchy · Health per-metric rings · Settings sheet anatomy · Tools bento composition · Stats layout · token architecture. Fix around these, not through them.

## 6. Order of operations
B1 → B2 → B3 → Orb → Bone swap → §3 sweep → re-screenshot everything in Ember Light + Bone Dark first (the two newest surfaces), then the rest. Capture-sheet screenshots reviewed on arrival against docs/screens/SCREEN-CAPTURE.md §11 + the orb spec.
