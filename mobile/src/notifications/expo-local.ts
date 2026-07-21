import * as Notifications from "expo-notifications";

import type { NotificationGateway, NotificationPermission, ScheduledNotification } from ".";

/** Install once at app startup so opted-in local reminders can display in foreground. */
export function installForegroundNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function permission(status: Notifications.PermissionStatus): NotificationPermission {
  return status === Notifications.PermissionStatus.GRANTED ? "granted" : status === Notifications.PermissionStatus.DENIED ? "denied" : "undetermined";
}

/** Local-only scheduling; this deliberately does not request or store a push token. */
export class ExpoLocalNotificationGateway implements NotificationGateway {
  async getPermission(): Promise<NotificationPermission> {
    return permission((await Notifications.getPermissionsAsync()).status);
  }

  async requestPermission(): Promise<NotificationPermission> {
    return permission((await Notifications.requestPermissionsAsync()).status);
  }

  async schedule(notification: ScheduledNotification): Promise<void> {
    const trigger: Notifications.DailyTriggerInput | Notifications.WeeklyTriggerInput = notification.weekday
      ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: notification.weekday, hour: notification.hour, minute: notification.minute }
      : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: notification.hour, minute: notification.minute };
    await Notifications.scheduleNotificationAsync({
      identifier: notification.id,
      content: { title: notification.title, body: notification.body, data: { kind: notification.kind } },
      trigger,
    });
  }

  async cancel(ids: readonly string[]): Promise<void> {
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  }
}
