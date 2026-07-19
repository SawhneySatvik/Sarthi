/**
 * Build the shipped Sarthi illustration set from the local, intentionally untracked
 * source drop. The manifest is explicit so a renamed/missing source fails loudly.
 */
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = join(root, "assets", "images");
const outputRoot = join(root, "public", "art");
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const QUALITY = 76;
const EFFORT = 6;

const crop = (width, height, position = "centre") => ({ width, height, position });

export const ART_MANIFEST = [
  ["today.header.dawn", "today-header-dawn.png", "today/dawn.webp", crop(1536, 512)],
  ["today.header.day", "today-header-day.png", "today/day.webp", crop(1536, 512)],
  ["today.header.dusk", "today-header-dusk.png", "today/dusk.webp", crop(1536, 512)],
  ["today.header.night", "today-header-night.png", "today/night.webp", crop(1536, 512)],
  ["habit.wake_dawn", "habbit-wake_up.png", "habits/wake_dawn.webp", crop(960, 540)],
  ["habit.make_bed", "habbit-make_bed.png", "habits/make_bed.webp", crop(960, 540)],
  ["habit.cold_morning", "habbit-shower.png", "habits/cold_morning.webp", crop(960, 540)],
  ["habit.journal", "habbit-journal.png", "habits/journal.webp", crop(960, 540)],
  ["habit.phone_down", "habbit-phone_down.png", "habits/phone_down.webp", crop(960, 540)],
  ["habit.meditate", "habbit-meditate.png", "habits/meditate.webp", crop(960, 540)],
  ["habit.night_routine", "habbit-night_routine.png", "habits/night_routine.webp", crop(960, 540)],
  ["health.meal_home", "health-meal.png", "health/meal_home.webp", crop(960, 540)],
  ["health.water", "health-water.png", "health/water.webp", crop(960, 540)],
  ["health.run_dawn", "health-run_dawn.png", "health/run_dawn.webp", crop(960, 540)],
  ["health.gym", "health-gym.png", "health/gym.webp", crop(960, 540)],
  ["health.stretch", "health-strech.png", "health/stretch.webp", crop(960, 540)],
  ["health.weigh", "health-weight.png", "health/weigh.webp", crop(960, 540)],
  ["skills.desk_code", "skill-desk-code.png", "skills/desk_code.webp", crop(960, 540)],
  ["skills.books", "skills-book.png", "skills/books.webp", crop(960, 540)],
  ["skills.whiteboard", "skills-whiteboard.png", "skills/whiteboard.webp", crop(960, 540)],
  ["skills.desk_night", "skills-night-work.png", "skills/desk_night.webp", crop(960, 540)],
  ["money.ledger", "money-ledger.png", "money/ledger.webp", crop(960, 540)],
  ["money.market", "money-vegetable-market.png", "money/market.webp", crop(960, 540)],
  ["money.jar", "money-coin-jar.png", "money/jar.webp", crop(960, 540)],
  ["tools.focus", "tools-focus-study.png", "tools/focus.webp", crop(720, 900)],
  ["tools.focus_detail", "tools-focus-desktop.png", "tools/focus_detail.webp", crop(720, 900)],
  ["tools.meditation", "tools-meditation.png", "tools/meditation.webp", crop(720, 900)],
  ["tools.afford", "money-ledger-with-protagonist.png", "tools/afford.webp", crop(720, 900)],
  ["tools.workout", "tools.workout.png", "tools/workout.webp", crop(720, 900)],
  ["onboard.welcome", "onboard-welcome.png", "onboard/welcome.webp", crop(720, 1280)],
  ["onboard.core", "onboard-core.png", "onboard/core.webp", crop(720, 1280)],
  ["onboard.generate", "onboard-generate.png", "onboard/generate.webp", crop(720, 1280)],
  ["onboard.confirm", "onboard-confirm.png", "onboard/confirm.webp", crop(720, 1280)],
  ["mile.arc_complete", "mile-arch_complete.png", "mile/arc_complete.webp", crop(960, 540)],
  ["mile.week_back", "mile-week_back.png", "mile/week_back.webp", crop(960, 540)],
  ["mile.levelup", "mile-levelup.png", "mile/levelup.webp", crop(960, 540)],
  ["mile.first_week", "mile-first_week.png", "mile/first_week.webp", crop(960, 540)],
  ["mile.hundred_hours", "mile-hundred_hours.png", "mile/hundred_hours.webp", crop(960, 540)],
  ["coach.week_band", "coach-week_band.png", "coach/week_band.webp", crop(1440, 240)],
  ["today.rest", "today-rest.png", "today/rest.webp", crop(960, 540)],
  ["today.done_evening", "today-done_evening.png", "today/done_evening.webp", crop(960, 540)],
].map(([key, source, output, resize]) => ({ key, source, output, ...resize }));

function fail(message) { throw new Error(`art build: ${message}`); }

function validateManifest({ requireSources = false } = {}) {
  const keys = new Set();
  const outputs = new Set();
  for (const asset of ART_MANIFEST) {
    if (keys.has(asset.key) || outputs.has(asset.output)) fail(`duplicate manifest key/output ${asset.key}`);
    if (!asset.output.endsWith(".webp")) fail(`non-WebP output ${asset.output}`);
    keys.add(asset.key);
    outputs.add(asset.output);
    if (requireSources && !existsSync(join(sourceRoot, asset.source))) fail(`missing source ${asset.source}`);
  }
}

async function validateOutputs() {
  let total = 0;
  for (const asset of ART_MANIFEST) {
    const output = join(outputRoot, asset.output);
    if (!existsSync(output)) fail(`missing output ${asset.output}`);
    const [metadata, size] = await Promise.all([sharp(output).metadata(), Promise.resolve(statSync(output).size)]);
    if (metadata.format !== "webp") fail(`non-WebP output ${asset.output}: ${metadata.format ?? "unknown"}`);
    if (metadata.width !== asset.width || metadata.height !== asset.height) fail(`wrong dimensions for ${asset.output}: ${metadata.width}x${metadata.height}`);
    total += size;
    console.log(`${asset.output} ${(size / 1024).toFixed(1)} KB`);
  }
  console.log(`total ${(total / 1024).toFixed(1)} KB / ${(MAX_TOTAL_BYTES / 1024).toFixed(0)} KB`);
  if (total > MAX_TOTAL_BYTES) fail(`payload ${(total / 1024).toFixed(1)} KB exceeds 3 MB`);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  validateManifest();
  if (checkOnly) {
    await validateOutputs();
    return;
  }

  if (!existsSync(sourceRoot)) fail("assets/images source drop is missing");
  validateManifest({ requireSources: true });
  rmSync(outputRoot, { recursive: true, force: true });
  for (const asset of ART_MANIFEST) {
    const destination = join(outputRoot, asset.output);
    mkdirSync(dirname(destination), { recursive: true });
    await sharp(join(sourceRoot, asset.source), { failOn: "error" })
      .rotate()
      .resize(asset.width, asset.height, { fit: "cover", position: asset.position, withoutEnlargement: false })
      .webp({ quality: QUALITY, effort: EFFORT, smartSubsample: true })
      .toFile(destination);
  }
  await validateOutputs();
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
