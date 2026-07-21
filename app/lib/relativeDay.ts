/**
 * Client-safe, display-only humanized day formatter (UIE-0d).
 *
 * Turns a `YYYY-MM-DD` local-day string into "Today" / "Yesterday" / "Mon 14 Jul".
 * This is presentation only — it owns NO timezone-persistence logic. "Today"/"Yesterday"
 * are resolved against the *device's* current calendar day (the `en-CA` trick, matching
 * `ReflectionMemory.today()`), because the browser is the right authority for "what day is
 * it for me right now". Older dates format deterministically from the passed string, so the
 * history rows below the fold never depend on wall-clock.
 */

function deviceDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Pure YYYY-MM-DD calendar arithmetic (DST-safe: anchored on UTC midnight). */
function addDays(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  return shifted.toISOString().slice(0, 10);
}

export function relativeDay(localDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return localDate;

  const today = deviceDay(new Date());
  if (localDate === today) return "Today";
  if (localDate === addDays(today, -1)) return "Yesterday";

  // Noon anchor keeps the label on the intended calendar day regardless of device zone.
  const date = new Date(`${localDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return localDate;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date);
}
