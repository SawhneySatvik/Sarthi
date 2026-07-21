/** Expo Notifications adapter contract. Permission is requested only by an explicit user action. */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export type ScheduledNotification = {
  id: string;
  kind: 'daily-brief' | 'streak-risk' | 'weekly-reflection';
  title: string;
  body: string;
  hour: number;
  minute: number;
  weekday?: number;
};

export type NotificationGateway = {
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  schedule(notification: ScheduledNotification): Promise<void>;
  cancel(ids: readonly string[]): Promise<void>;
};

export type NotificationPreferences = {
  dailyBrief: boolean;
  streakRisk: boolean;
  weeklyReflection: boolean;
  briefHour: number;
  briefMinute: number;
  weeklyWeekday: number;
};

const notificationIds = ['daily-brief', 'streak-risk', 'weekly-reflection'] as const;

export async function enableNotifications(gateway: NotificationGateway, preferences: NotificationPreferences): Promise<NotificationPermission> {
  const permission = (await gateway.getPermission()) === 'granted'
    ? 'granted'
    : await gateway.requestPermission();
  if (permission !== 'granted') return permission;
  await scheduleNotifications(gateway, preferences);
  return permission;
}

export async function scheduleNotifications(gateway: NotificationGateway, preferences: NotificationPreferences): Promise<void> {
  await gateway.cancel(notificationIds);
  const schedule: ScheduledNotification[] = [];
  if (preferences.dailyBrief) {
    schedule.push({ id: 'daily-brief', kind: 'daily-brief', title: 'Your daily plan', body: 'Your next small step is ready.', hour: preferences.briefHour, minute: preferences.briefMinute });
  }
  if (preferences.streakRisk) {
    schedule.push({ id: 'streak-risk', kind: 'streak-risk', title: 'Keep today gentle', body: 'There is still time for one small win.', hour: preferences.briefHour, minute: preferences.briefMinute });
  }
  if (preferences.weeklyReflection) {
    schedule.push({ id: 'weekly-reflection', kind: 'weekly-reflection', title: 'Weekly reflection', body: 'Take a moment to look back at the week.', hour: preferences.briefHour, minute: preferences.briefMinute, weekday: preferences.weeklyWeekday });
  }
  await Promise.all(schedule.map((entry) => gateway.schedule(entry)));
}
