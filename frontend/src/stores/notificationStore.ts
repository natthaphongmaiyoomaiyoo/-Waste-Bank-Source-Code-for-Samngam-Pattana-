import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  notificationType: string;
  isRead: boolean;
  createdAt: string;
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [] as AppNotification[],
    loading: false,
  }),

  getters: {
    unread: (state) => state.notifications.filter((n) => !n.isRead),
  },

  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get<AppNotification[]>('/notifications');
        this.notifications = data;
      } catch {
        // Notifications are a non-critical, supplementary feature - fail silently
        // and just leave the list empty rather than blocking the page with an error.
      } finally {
        this.loading = false;
      }
    },

    async markRead(ids: number[]) {
      const unread = this.notifications.filter((n) => !n.isRead && ids.includes(n.id));
      if (!unread.length) return;

      try {
        await api.patch('/notifications/read', { ids: unread.map((n) => n.id) });
        for (const notification of unread) notification.isRead = true;
      } catch {
        // leave as unread if the request failed
      }
    },
  },
});
