Screenshot-verify the screen: $ARGUMENTS

1. Start the dev server. Using the chrome-devtools MCP + computer_use, open the screen at BOTH
   390px (mobile, the gate) and desktop width.
2. Capture EVERY meaningful state listed in that screen's SCREEN-*.md verify checklist.
3. Inspect the RENDERED result (not just the code) against Premium Dark / the active theme:
   - tokens-only (no stray hex), amber only on XP/streak/level, coach voice in Fraunces
   - shimmer-not-spinner, one focal element per viewport, de-slop laws (no card-of-cards)
   - AA contrast; the required states from the spec all present
4. Save shots to .verify/screens/<screen>-<state>-<width>.png. List every deviation, fix, re-shoot
   until the checklist passes. Report the diff of token values you changed (fold back into DESIGN.md).
