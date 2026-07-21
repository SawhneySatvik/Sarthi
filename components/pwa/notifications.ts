/*
 * components/pwa/notifications.ts — browser-only notification + local-reminder helpers (T3).
 *
 * DESIGN NOTES / GUARDRAILS
 *  - Client-only. Every entry point guards `typeof window`/feature presence and degrades to a
 *    no-op rather than throwing, so SSR and unsupported browsers are safe.
 *  - We NEVER call `navigator.serviceWorker.ready` — with the SW flag left OFF in prod, no SW
 *    is ever registered and `.ready` is a promise that resolves NEVER (a silent hang). We use
 *    `getRegistration()`, which resolves `undefined` when there is none.
 *  - We NEVER use `new Notification(...)` as a fallback — it throws "Illegal constructor" on
 *    Android Chrome. All notifications go through `registration.showNotification(...)`; with no
 *    registration present, we report "unavailable" honestly instead of pretending.
 *  - LOCAL scheduling is timeout-based and therefore only fires WHILE A TAB IS OPEN. That is the
 *    honest limit of a keyless build; true background delivery is the deferred server-push path.
 *
 * DEFERRED (see `subscribeToPush` + public/sw.js `push` listener): VAPID subscription store and
 * the server sender. Nothing here talks to a backend.
 */

/** localStorage keys — the reminders opt-in plus the brief-time prefs T2 persists. */
export const REMINDERS_ENABLED_KEY = "sarthi-settings-remindersEnabled";
const MORNING_TIME_KEY = "sarthi-settings-morningBriefTime";
const WEEKLY_DAY_KEY = "sarthi-settings-weeklyBriefDay";
const WEEKLY_TIME_KEY = "sarthi-settings-weeklyBriefTime";
const BRIEF_MODE_KEY = "sarthi-settings-brief"; // "all" | "weekly" | "off"

export type NotificationState = "unsupported" | "default" | "granted" | "denied";

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/** True only when both Notifications and the SW API exist — the SW is required to actually
 *  show a notification (registration.showNotification), so we gate the whole feature on it. */
export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function getNotificationState(): NotificationState {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission as NotificationState;
}

/** Opt-in only — call from an explicit user gesture, never on load. */
export async function requestNotificationPermission(): Promise<NotificationState> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result as NotificationState;
  } catch {
    return "denied";
  }
}

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function remindersEnabled(): boolean {
  return readPref(REMINDERS_ENABLED_KEY, "off") === "on";
}

export function setRemindersEnabled(on: boolean): void {
  try {
    localStorage.setItem(REMINDERS_ENABLED_KEY, on ? "on" : "off");
  } catch {
    /* private-mode storage — reminders simply don't persist this session */
  }
}

/** The SW registration if one exists — `undefined` when the SW flag is off (no hang). */
async function currentRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Show a notification through the SW registration. Returns false (never throws) when
 * permission isn't granted or no SW is registered — the honest "couldn't fire" signal.
 */
export async function showLocalNotification(
  title: string,
  options: NotificationOptions & { data?: { url?: string } } = {},
): Promise<boolean> {
  if (getNotificationState() !== "granted") return false;
  const registration = await currentRegistration();
  if (!registration) return false;
  try {
    await registration.showNotification(title, {
      icon: "/icon-192",
      badge: "/icon-192",
      tag: "sarthi-reminder",
      ...options,
      data: { url: "/today", ...(options.data ?? {}) },
    });
    return true;
  } catch {
    return false;
  }
}

function parseHhmm(value: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function msUntilNextDaily(hhmm: string, now: Date): number | null {
  const parsed = parseHhmm(hhmm);
  if (!parsed) return null;
  const next = new Date(now);
  next.setHours(parsed.h, parsed.m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function msUntilNextWeekly(day: string, hhmm: string, now: Date): number | null {
  const weekday = WEEKDAY_INDEX[day];
  const parsed = parseHhmm(hhmm);
  if (weekday === undefined || !parsed) return null;
  const next = new Date(now);
  next.setHours(parsed.h, parsed.m, 0, 0);
  let dayDelta = (weekday - now.getDay() + 7) % 7;
  if (dayDelta === 0 && next.getTime() <= now.getTime()) dayDelta = 7;
  next.setDate(next.getDate() + dayDelta);
  return next.getTime() - now.getTime();
}

/**
 * Arm timeout-based local reminders from the T2 brief-time prefs. Returns a cleanup that
 * clears every pending timer. No-op (returns a no-op cleanup) unless reminders are enabled
 * AND permission is already granted — this function NEVER requests permission itself.
 *
 * Fires ONLY while a tab is open (timeout-based); background delivery is the deferred push
 * path. Each timer re-arms itself after firing so a long-lived tab keeps its cadence.
 */
export function scheduleLocalReminders(): () => void {
  if (!remindersEnabled() || getNotificationState() !== "granted") return () => {};

  const briefMode = readPref(BRIEF_MODE_KEY, "all"); // "all" | "weekly" | "off"
  if (briefMode === "off") return () => {};

  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;

  const arm = (
    computeDelay: (now: Date) => number | null,
    fire: () => void,
  ) => {
    const delay = computeDelay(new Date());
    if (delay === null) return;
    // setTimeout tops out at ~24.8 days; weekly (≤7 days) is comfortably under it.
    const id = setTimeout(() => {
      if (cancelled) return;
      fire();
      arm(computeDelay, fire); // re-arm for the next period
    }, delay);
    timers.push(id);
  };

  if (briefMode === "all") {
    const morning = readPref(MORNING_TIME_KEY, "07:00");
    arm(
      (now) => msUntilNextDaily(morning, now),
      () => void showLocalNotification("Your morning brief is ready", {
        body: "Open Sarthi to see today's plan and your coach's first line.",
        tag: "sarthi-morning-brief",
      }),
    );
  }

  const weeklyDay = readPref(WEEKLY_DAY_KEY, "sun");
  const weeklyTime = readPref(WEEKLY_TIME_KEY, "18:00");
  arm(
    (now) => msUntilNextWeekly(weeklyDay, weeklyTime, now),
    () => void showLocalNotification("Your weekly reflection is ready", {
      body: "Look back on the week with your coach.",
      tag: "sarthi-weekly-brief",
    }),
  );

  return () => {
    cancelled = true;
    for (const id of timers) clearTimeout(id);
  };
}

/* -------------------------------------------------------------------------------------------
 * DEFERRED SEAM — server-sent web push. Intentionally NOT wired to a backend.
 *
 * To finish this later:
 *   1. Generate a VAPID keypair (local, one-time): `npx web-push generate-vapid-keys`.
 *   2. Expose the PUBLIC key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; keep the private key server-only.
 *   3. Build `POST /api/push/subscribe` to persist `registration.pushManager.subscribe(...)`
 *      results in a per-user subscription store (userId-scoped, via the repository layer).
 *   4. Build a server sender that POSTs to each subscription's endpoint (the `web-push` lib),
 *      which wakes the `push` listener already present in public/sw.js.
 *
 * The function below is a typed placeholder so the call site exists; it performs NO network
 * work and returns a clear "deferred" result until the pieces above land.
 * ----------------------------------------------------------------------------------------- */
export async function subscribeToPush(): Promise<
  { ok: false; reason: "deferred" | "unsupported" | "not-registered" | "denied" }
> {
  if (!notificationsSupported()) return { ok: false, reason: "unsupported" };
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return { ok: false, reason: "deferred" };
  const registration = await currentRegistration();
  if (!registration) return { ok: false, reason: "not-registered" };
  if (getNotificationState() !== "granted") return { ok: false, reason: "denied" };
  // Server subscription store + sender are deferred — do NOT subscribe without a backend to
  // receive it (an orphaned subscription would silently drop every push).
  return { ok: false, reason: "deferred" };
}
