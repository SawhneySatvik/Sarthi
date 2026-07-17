import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { scanCoreBoundary } from "../scripts/check-core-boundary.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const fixturesDirectory = resolve(testDirectory, "fixtures/core-boundary");

test("the repository core tree satisfies the import boundary", () => {
  assert.deepEqual(scanCoreBoundary(resolve(testDirectory, "..")), []);
});

test("safe core imports remain permitted", () => {
  assert.deepEqual(scanCoreBoundary(resolve(fixturesDirectory, "safe")), []);
});

const forbiddenFixtures = [
  ["next", "core/bad.ts", "next/headers", "core may not import Next.js"],
  ["next-import-type", "core/bad.ts", "next", "core may not import Next.js"],
  ["react", "core/bad.tsx", "react", "core may not import React"],
  ["drizzle", "core/bad.ts", "drizzle-orm", "core may not import Drizzle"],
  ["supabase", "core/bad.ts", "@supabase/supabase-js", "core may not import Supabase"],
  ["ai-sdk", "core/bad.ts", "@ai-sdk/google", "core may not import a concrete AI SDK provider"],
  ["provider-relative", "core/bad.ts", "../providers/fake", "core may not import concrete providers"],
  ["provider-alias", "core/bad.ts", "@/providers/fake", "core may not import concrete providers"],
  ["provider-alias-normalized", "core/bad.ts", "@/core/../providers/fake", "core may not import concrete providers"],
  ["dynamic-comment", "core/bad.ts", "@ai-sdk/google", "core may not import a concrete AI SDK provider"],
  ["require-comment", "core/bad.ts", "@supabase/supabase-js", "core may not import Supabase"],
];

for (const [fixture, file, specifier, rule] of forbiddenFixtures) {
  test(`rejects the ${fixture} forbidden import`, () => {
    assert.deepEqual(scanCoreBoundary(resolve(fixturesDirectory, fixture)), [{
      file,
      specifier,
      rule,
    }]);
  });
}
