/**
 * tests/tokens.test.ts — SAR-005 token-layer parity guard. Keyless, no DOM.
 * Proves all six [data-theme][data-mode] blocks define the SAME variable set (so a
 * component can never reference a token that a theme forgot to remap), and that
 * `@theme inline` references no orphan variable. This is the "tokens.test if
 * feasible" the plan flagged — CI-guarded instead of review-guarded.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/globals.css", "utf8");

const COMBOS = [
  ["ember", "dark"],
  ["ember", "light"],
  ["bone", "dark"],
  ["bone", "light"],
  ["moss", "dark"],
  ["moss", "light"],
] as const;

// next/font injects these at runtime via <html> className, not in globals.css.
const RUNTIME_FONT_VARS = new Set(["--font-ui-family", "--font-coach-family", "--font-display-family"]);

function blockBody(theme: string, mode: string): string {
  const match = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\[data-mode="${mode}"\\]\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing token block for ${theme} ${mode}`);
  return match[1];
}

function declaredVars(body: string): Set<string> {
  return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

test("all six theme-mode blocks exist and define an identical variable set", () => {
  const sets = COMBOS.map(([theme, mode]) => declaredVars(blockBody(theme, mode)));
  const base = [...sets[0]].sort();
  assert.ok(base.length > 0, "ember dark defines no variables");
  for (let i = 1; i < sets.length; i++) {
    const [theme, mode] = COMBOS[i];
    assert.deepEqual([...sets[i]].sort(), base, `${theme} ${mode} variable set differs from ember dark`);
  }
});

test("@theme inline references no orphan variable", () => {
  const themeBlock = css.match(/@theme inline\s*\{([^}]*)\}/);
  assert.ok(themeBlock, "missing @theme inline block");
  const referenced = new Set([...themeBlock[1].matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));

  const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(rootMatch, "missing :root block");
  const rootVars = declaredVars(rootMatch[1]);
  const emberDark = declaredVars(blockBody("ember", "dark"));

  for (const ref of referenced) {
    const defined = rootVars.has(ref) || emberDark.has(ref) || RUNTIME_FONT_VARS.has(ref);
    assert.ok(defined, `@theme inline references undefined variable ${ref}`);
  }
});
