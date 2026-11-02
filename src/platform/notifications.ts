import type { NotificationScheduler } from '@alp/core';

/**
 * Web: notifications are hidden (§4.8). Native scheduling via expo-notifications
 * follows in milestone M5; until then both platforms use this no-op adapter.
 */
export const notifications: NotificationScheduler = {
  replaceAll: async () => {},
};
