import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

export interface SystemLog {
  id: number;
  userId: number | null;
  actionType: string;
  module: string;
  action: string;
  detail: string;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    fullName: string;
    role: { id: number; roleName: string } | null;
  };
}

export const useSystemLogStore = defineStore('systemLog', {
  state: () => ({
    logs: [] as SystemLog[],
    // Rows matching the last fetchLogsPage filters, across every page.
    pageTotal: 0,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    // One page of the log, searched and filtered on the server - so a search
    // reaches every row, not just the most recent ones.
    async fetchLogsPage(filters: {
      page: number;
      pageSize: number;
      search?: string | undefined;
      actionType?: string | undefined;
      descending?: boolean | undefined;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const params = Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
        );
        const { data } = await api.get<{ items: SystemLog[]; total: number }>(
          '/admin/system-logs',
          { params },
        );
        this.logs = data.items;
        this.pageTotal = data.total;
        return data;
      } catch (err: unknown) {
        this.error = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.message || 'Failed to fetch system logs';
        throw err;
      } finally {
        this.loading = false;
      }
    },
  }
});
