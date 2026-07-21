/** The only public-art lookup boundary. Components use semantic keys, never paths. */
export type ArtAccent = "overall" | "health" | "money" | "habits" | "skills";

export const ART = {
  "today.header.dawn": { src: "/art/today/dawn.webp", alt: "First light at a window", accent: "overall" },
  "today.header.day": { src: "/art/today/day.webp", alt: "A quiet desk in daylight", accent: "overall" },
  "today.header.dusk": { src: "/art/today/dusk.webp", alt: "Golden hour over the city", accent: "overall" },
  "today.header.night": { src: "/art/today/night.webp", alt: "A lamplit room at night", accent: "overall" },
  "today.rest": { src: "/art/today/rest.webp", alt: "A quiet moment of rest", accent: "overall" },
  "today.done_evening": { src: "/art/today/done_evening.webp", alt: "A calm evening after a full day", accent: "overall" },
  // UIE-0e — interim `src` points at the calm-evening plate until UIE-1's ASSETS-02 batch ships
  // the real summit/threshold scene (protagonist from behind/afar, warm dusk, no visible faces).
  "today.arc_complete": { src: "/art/today/done_evening.webp", alt: "A summit reached at golden hour, seen from behind", accent: "overall" },
  "habit.wake_dawn": { src: "/art/habits/wake_dawn.webp", alt: "Waking in the first light", accent: "habits" },
  "habit.make_bed": { src: "/art/habits/make_bed.webp", alt: "Making the bed in the morning", accent: "habits" },
  "habit.cold_morning": { src: "/art/habits/cold_morning.webp", alt: "A quiet blue-hour bathroom", accent: "habits" },
  "habit.journal": { src: "/art/habits/journal.webp", alt: "Writing by lamplight", accent: "habits" },
  "habit.phone_down": { src: "/art/habits/phone_down.webp", alt: "A phone set aside for the evening", accent: "habits" },
  "habit.meditate": { src: "/art/habits/meditate.webp", alt: "A quiet meditation space", accent: "habits" },
  "habit.night_routine": { src: "/art/habits/night_routine.webp", alt: "A calm night routine", accent: "habits" },
  "health.meal_home": { src: "/art/health/meal_home.webp", alt: "A home-cooked meal", accent: "health" },
  "health.water": { src: "/art/health/water.webp", alt: "Water catching window light", accent: "health" },
  "health.run_dawn": { src: "/art/health/run_dawn.webp", alt: "A dawn run", accent: "health" },
  "health.gym": { src: "/art/health/gym.webp", alt: "A quiet gym floor", accent: "health" },
  "health.stretch": { src: "/art/health/stretch.webp", alt: "Stretching in morning light", accent: "health" },
  "health.weigh": { src: "/art/health/weigh.webp", alt: "A scale by a window", accent: "health" },
  "skills.desk_code": { src: "/art/skills/desk_code.webp", alt: "Focused work at a glowing screen", accent: "skills" },
  "skills.books": { src: "/art/skills/books.webp", alt: "Study notes under a lamp", accent: "skills" },
  "skills.whiteboard": { src: "/art/skills/whiteboard.webp", alt: "Working through a whiteboard problem", accent: "skills" },
  "skills.desk_night": { src: "/art/skills/desk_night.webp", alt: "A late-night practice desk", accent: "skills" },
  "money.ledger": { src: "/art/money/ledger.webp", alt: "A ledger and receipts", accent: "money" },
  "money.market": { src: "/art/money/market.webp", alt: "A market street at dusk", accent: "money" },
  "money.jar": { src: "/art/money/jar.webp", alt: "A jar of coins on a windowsill", accent: "money" },
  "tools.focus": { src: "/art/tools/focus.webp", alt: "A deep-work desk", accent: "skills" },
  "tools.focus_detail": { src: "/art/tools/focus_detail.webp", alt: "A focused work room", accent: "skills" },
  "tools.meditation": { src: "/art/tools/meditation.webp", alt: "A meditation cushion in quiet light", accent: "habits" },
  "tools.afford": { src: "/art/tools/afford.webp", alt: "A ledger by an evening window", accent: "money" },
  "tools.workout": { src: "/art/tools/workout.webp", alt: "A barbell corner in a quiet gym", accent: "health" },
  "onboard.welcome": { src: "/art/onboard/welcome.webp", alt: "A path at sunrise", accent: "overall" },
  "onboard.core": { src: "/art/onboard/core.webp", alt: "A quiet morning room", accent: "overall" },
  "onboard.generate": { src: "/art/onboard/generate.webp", alt: "Four colors over a valley", accent: "overall" },
  "onboard.confirm": { src: "/art/onboard/confirm.webp", alt: "A path leading forward", accent: "overall" },
  "mile.arc_complete": { src: "/art/mile/arc_complete.webp", alt: "A summit at golden hour", accent: "overall" },
  "mile.week_back": { src: "/art/mile/week_back.webp", alt: "A road behind you", accent: "overall" },
  "mile.levelup": { src: "/art/mile/levelup.webp", alt: "A lantern being lit", accent: "overall" },
  "mile.first_week": { src: "/art/mile/first_week.webp", alt: "A small sapling on a sill", accent: "overall" },
  "mile.hundred_hours": { src: "/art/mile/hundred_hours.webp", alt: "Dawn from a city desk", accent: "overall" },
  "coach.week_band": { src: "/art/coach/week_band.webp", alt: "A misty morning horizon", accent: "overall" },
  // UIE-1 (D-052) — new calm placements. The WebPs are authored externally per
  // `docs/experience/ASSETS-02.md` and dropped in later; until then the ArtFrame
  // plate+grain fallback renders (intentional, not broken — no ART_MANIFEST row yet,
  // so `art:check` stays green). Overall accent → neutral plate, never amber.
  "stats.overview": { src: "/art/stats/overview.webp", alt: "A wide calm vista, a figure small before the whole horizon", accent: "overall" },
  "empty.stillness": { src: "/art/empty/stillness.webp", alt: "A quiet room at first light, waiting to begin", accent: "overall" },
} as const satisfies Record<string, { src: string; alt: string; accent: ArtAccent }>;

export type ArtKey = keyof typeof ART;
export type ArtDomain = "health" | "money" | "habits" | "skills" | "overall";

/**
 * UIE-1 (D-052) — keys whose painterly WebP is authored externally (see
 * `docs/experience/ASSETS-02.md`) and not yet in `public/art`. `ArtFrame` skips the
 * `<Image>` for these so the plate+grain fallback is the *primary* paint — deliberate,
 * and with zero network request so next/image never logs a 400 for the missing source.
 * Remove a key here (and repoint its src) the moment its real asset ships.
 */
const PENDING_ART: ReadonlySet<ArtKey> = new Set<ArtKey>(["stats.overview", "empty.stillness"]);
export const isArtPending = (key: ArtKey): boolean => PENDING_ART.has(key);

const DOMAIN_FALLBACK: Record<Exclude<ArtDomain, "overall">, ArtKey> = {
  health: "health.meal_home",
  money: "money.ledger",
  habits: "habit.journal",
  skills: "skills.desk_code",
};

const TITLE_MATCHES: ReadonlyArray<readonly [string, ArtKey]> = [
  ["wake", "habit.wake_dawn"], ["bed", "habit.make_bed"], ["shower", "habit.cold_morning"], ["journal", "habit.journal"], ["phone", "habit.phone_down"], ["meditat", "habit.meditate"], ["night", "habit.night_routine"],
  ["meal", "health.meal_home"], ["food", "health.meal_home"], ["water", "health.water"], ["run", "health.run_dawn"], ["gym", "health.gym"], ["workout", "health.gym"], ["stretch", "health.stretch"], ["weigh", "health.weigh"],
  ["code", "skills.desk_code"], ["design", "skills.whiteboard"], ["study", "skills.books"], ["read", "skills.books"], ["practice", "skills.desk_night"],
  ["market", "money.market"], ["spend", "money.ledger"], ["budget", "money.ledger"], ["save", "money.jar"], ["coin", "money.jar"],
];

/** Stable, data-only scene selection for existing typed plan titles. */
export function selectPlanArt(domain: ArtDomain, title: string): ArtKey | null {
  const normalized = title.trim().toLowerCase();
  for (const [needle, key] of TITLE_MATCHES) if (normalized.includes(needle)) return key;
  return domain === "overall" ? null : DOMAIN_FALLBACK[domain];
}

export function selectJourneyArt(domain: Exclude<ArtDomain, "overall">, entryKind: string, label: string): ArtKey {
  return selectPlanArt(domain, `${entryKind} ${label}`) ?? DOMAIN_FALLBACK[domain];
}

export function todayHeaderArt(hour: number): ArtKey {
  if (hour < 10) return "today.header.dawn";
  if (hour < 17) return "today.header.day";
  if (hour < 21) return "today.header.dusk";
  return "today.header.night";
}

export function milestoneArt(label: string): ArtKey {
  const text = label.toLowerCase();
  if (text.includes("100")) return "mile.hundred_hours";
  if (text.includes("first week")) return "mile.first_week";
  if (text.includes("level")) return "mile.levelup";
  if (text.includes("week")) return "mile.week_back";
  return "mile.arc_complete";
}
