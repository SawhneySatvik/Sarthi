import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ART, milestoneArt, selectPlanArt, todayHeaderArt } from "@/components/art/registry";

const ROOT = process.cwd();
const ART_ROOT = join(ROOT, "public", "art");

const EXPECTED_PUBLIC_ART = {
  "today.header.dawn": "/art/today/dawn.webp",
  "today.header.day": "/art/today/day.webp",
  "today.header.dusk": "/art/today/dusk.webp",
  "today.header.night": "/art/today/night.webp",
  "habit.wake_dawn": "/art/habits/wake_dawn.webp",
  "habit.make_bed": "/art/habits/make_bed.webp",
  "habit.cold_morning": "/art/habits/cold_morning.webp",
  "habit.journal": "/art/habits/journal.webp",
  "habit.phone_down": "/art/habits/phone_down.webp",
  "habit.meditate": "/art/habits/meditate.webp",
  "habit.night_routine": "/art/habits/night_routine.webp",
  "health.meal_home": "/art/health/meal_home.webp",
  "health.water": "/art/health/water.webp",
  "health.run_dawn": "/art/health/run_dawn.webp",
  "health.gym": "/art/health/gym.webp",
  "health.stretch": "/art/health/stretch.webp",
  "health.weigh": "/art/health/weigh.webp",
  "skills.desk_code": "/art/skills/desk_code.webp",
  "skills.books": "/art/skills/books.webp",
  "skills.whiteboard": "/art/skills/whiteboard.webp",
  "skills.desk_night": "/art/skills/desk_night.webp",
  "money.ledger": "/art/money/ledger.webp",
  "money.market": "/art/money/market.webp",
  "money.jar": "/art/money/jar.webp",
  "tools.focus": "/art/tools/focus.webp",
  "tools.focus_detail": "/art/tools/focus_detail.webp",
  "tools.meditation": "/art/tools/meditation.webp",
  "tools.afford": "/art/tools/afford.webp",
  "tools.workout": "/art/tools/workout.webp",
  "onboard.welcome": "/art/onboard/welcome.webp",
  "onboard.core": "/art/onboard/core.webp",
  "onboard.generate": "/art/onboard/generate.webp",
  "onboard.confirm": "/art/onboard/confirm.webp",
  "mile.arc_complete": "/art/mile/arc_complete.webp",
  "mile.week_back": "/art/mile/week_back.webp",
  "mile.levelup": "/art/mile/levelup.webp",
  "mile.first_week": "/art/mile/first_week.webp",
  "mile.hundred_hours": "/art/mile/hundred_hours.webp",
  "coach.week_band": "/art/coach/week_band.webp",
  "today.rest": "/art/today/rest.webp",
  "today.done_evening": "/art/today/done_evening.webp",
  // UIE-0e — interim src reuses done_evening.webp until UIE-1 ships the real summit scene.
  "today.arc_complete": "/art/today/done_evening.webp",
} as const;

// UIE-1 (D-052) — new calm placements (Stats header, empty Journey). Their WebPs are
// authored externally per docs/experience/ASSETS-02.md and dropped in later; until then
// the ArtFrame plate+grain fallback renders by design, so these keys are intentionally
// NOT yet on disk and are exempt from the shipped-file check. They still must be a real
// /art/*.webp path with no raw-source leak, and carry no ART_MANIFEST row (art:check green).
const PENDING_PUBLIC_ART = {
  "stats.overview": "/art/stats/overview.webp",
  "empty.stillness": "/art/empty/stillness.webp",
} as const;

function listPublicArt(directory: string, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${prefix}${entry.name}`;
    return entry.isDirectory() ? listPublicArt(join(directory, entry.name), `${relativePath}/`) : [relativePath];
  });
}

test("art registry owns all supplied scenes and deterministic title/domain fallbacks", () => {
  assert.equal(Object.keys(ART).length, 44);
  assert.deepEqual(Object.fromEntries(Object.entries(ART).map(([key, asset]) => [key, asset.src])), { ...EXPECTED_PUBLIC_ART, ...PENDING_PUBLIC_ART });
  assert.equal(selectPlanArt("health", "Morning water"), "health.water");
  assert.equal(selectPlanArt("money", "A new plan"), "money.ledger");
  assert.equal(selectPlanArt("skills", "Practice violin"), "skills.desk_night");
  assert.equal(selectPlanArt("overall", "A new plan"), null);
  assert.equal(todayHeaderArt(6), "today.header.dawn");
  assert.equal(todayHeaderArt(12), "today.header.day");
  assert.equal(todayHeaderArt(18), "today.header.dusk");
  assert.equal(todayHeaderArt(23), "today.header.night");
  assert.equal(milestoneArt("100h - System design"), "mile.hundred_hours");
});

test("committed public art validates without raw sources, stays inside the signed payload, and has no raw source path", () => {
  execFileSync(process.execPath, ["scripts/build-art.mjs", "--check"], { cwd: ROOT, stdio: "pipe" });
  const pendingSrcs = new Set<string>(Object.values(PENDING_PUBLIC_ART));
  let total = 0;
  for (const asset of Object.values(ART)) {
    assert.match(asset.src, /^\/art\/.+\.webp$/);
    assert.equal(asset.src.includes("assets/images"), false);
    // Pending placements render the ArtFrame plate fallback until their WebP lands — exempt from disk check.
    if (pendingSrcs.has(asset.src)) continue;
    const path = join(ROOT, "public", asset.src);
    assert.equal(existsSync(path), true, `${asset.src} is shipped`);
    total += statSync(path).size;
  }
  assert.ok(total <= 3 * 1024 * 1024);
  assert.equal(readFileSync(join(ROOT, "components", "art", "registry.ts"), "utf8").includes("assets/images"), false);
  assert.equal(existsSync(ART_ROOT), true);
  assert.deepEqual(
    listPublicArt(ART_ROOT).sort(),
    // De-dupe: UIE-0e's `today.arc_complete` interim-reuses an already-shipped file, so two
    // registry keys map to one path — the on-disk set stays 1:1 with the unique src paths.
    [...new Set(Object.values(EXPECTED_PUBLIC_ART).map((src) => src.replace("/art/", "")))].sort(),
  );
});
