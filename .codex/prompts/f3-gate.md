Run the Day-1 acceptance gate (FLOWS.md F3 — the canonical capture loop).

1. Ensure the app runs on the `fake` stack with NO API keys set (LLM_PROVIDER=fake, VOICE_PROVIDER=fake).
2. Drive the loop with the canonical dump: "Spent 340 on lunch, 2 rotis and dal, drank a bottle,
   90 min of system design, woke at 5:10."
3. Assert, end to end, with Health as the store:
   - raw quote pins → deep-tier parse → CaptureDraft with domain-tagged proposals
   - route-by-confidence: explicit values (₹340, 500ml, 90min) auto-write into the "filed" strip;
     the estimated meal (≈kcal) surfaces as a swipe CARD (never auto-written)
   - swipe accept writes a TYPED row; discard writes nothing; chip-flip changes domain; long-press shows "why"
   - XP awards; Today shows the matching items checked "via capture"; every write is undoable
4. Report PASS/FAIL per assertion with file refs. If PASS on fake, re-run once with real Gemini keys.
Do not declare done unless the fake-stack run is green and keyless.
