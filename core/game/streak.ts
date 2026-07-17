/**
 * core/game/streak.ts — pure, grace-aware streak computation (SAR-004, D-G).
 *
 * Operates on ISO `YYYY-MM-DD` local dates. Deterministic: dates are parsed to
 * UTC day-numbers via `Date.UTC` (a pure function of its arguments — no clock
 * read). `graceDays` is how many missed days a streak tolerates before breaking:
 * a gap of `graceDays + 1` calendar days between two active days still counts.
 */

/** Whole-day number for an ISO `YYYY-MM-DD` (UTC midnight / 86400s). */
export function toDayNumber(localDate: string): number {
  const [year, month, day] = localDate.split("-").map((part) => Number.parseInt(part, 10));
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Absolute whole-day distance between two ISO local dates. */
export function daysBetween(a: string, b: string): number {
  return Math.abs(toDayNumber(a) - toDayNumber(b));
}

/**
 * The current streak ending at/near `today`, tolerating gaps of up to `graceDays`
 * missed days. Returns 0 when there is no activity or the most recent activity is
 * already past the grace window from `today`.
 */
export function computeStreak(
  localDates: readonly string[],
  today: string,
  graceDays: number,
): number {
  if (localDates.length === 0) {
    return 0;
  }
  const grace = graceDays > 0 ? Math.floor(graceDays) : 0;
  // Unique active days, most-recent first.
  const descending = Array.from(new Set(localDates)).sort().reverse();

  // The latest active day must be within the grace window of `today` to be "current".
  if (daysBetween(descending[0], today) > grace) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < descending.length; i++) {
    const gap = daysBetween(descending[i], descending[i - 1]);
    if (gap === 0) {
      continue; // same day (defensive; Set already dedupes)
    }
    if (gap <= grace + 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * The streak after one new active day, given the prior streak + last active day.
 * Cheap incremental form used at commit time (no full-history query): same day
 * keeps the streak, a within-grace gap extends it, a larger gap resets to 1.
 */
export function nextStreak(
  currentStreak: number,
  lastActiveDate: string | null,
  newLocalDate: string,
  graceDays: number,
): number {
  if (lastActiveDate === null) {
    return 1;
  }
  const grace = graceDays > 0 ? Math.floor(graceDays) : 0;
  const gap = daysBetween(lastActiveDate, newLocalDate);
  if (gap === 0) {
    return Math.max(currentStreak, 1);
  }
  if (gap <= grace + 1) {
    return currentStreak + 1;
  }
  return 1;
}
