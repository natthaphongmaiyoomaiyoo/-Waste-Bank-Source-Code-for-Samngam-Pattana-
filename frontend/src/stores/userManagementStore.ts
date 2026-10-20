import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

export interface SystemUser {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  role: { id: number; roleName: string };
  member?: { memberCode: string } | null;
  status: string; // 'active' | 'inactive'
  lastLogin: string | null;
}

// One page of the user table plus the account counts for its cards.
export interface UserPageFilters {
  page: number;
  pageSize: number;
  search?: string | undefined;
  roleId?: number | undefined;
  status?: string | undefined;
}

export interface UserSummary {
  total: number;
  active: number;
  inactive: number;
}

export const useUserManagementStore = defineStore('userManagement', {
  state: () => ({
    users: [] as SystemUser[],
    // Accounts matching the last fetchUsersPage filters, across every page.
    pageTotal: 0,
    summary: { total: 0, active: 0, inactive: 0 } as UserSummary,
    loading: false,
    error: null as string | null,
  }),
  
  actions: {
    // The user table: one page, filtered on the server.
    async fetchUsersPage(filters: UserPageFilters) {
      this.loading = true;
      this.error = null;
      try {
        const params = Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
        );
        const { data } = await api.get<{
          items: SystemUser[];
          total: number;
          summary: UserSummary;
        }>('/admin/users', { params });
        this.users = data.items;
        this.pageTotal = data.total;
        this.summary = data.summary;
        return data;
      } catch (err: unknown) {
        this.error = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.message || 'Failed to fetch users';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchUsers() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<SystemUser[]>('/admin/users');
        this.users = data;
      } catch (err: unknown) {
        this.error = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.message || 'Failed to fetch users';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async createUser(payload: { username: string; password?: string; fullName: string; phone?: string; roleId: number }) {
      this.loading = true;
      try {
        const { data } = await api.post<SystemUser>('/admin/users', payload);
        this.users.unshift(data);
        return data;
      } catch (err: unknown) {
        this.error = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.message || 'Failed to create user';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async updateUser(id: number, payload: { fullName?: string; phone?: string; roleId?: number; password?: string }) {
      this.loading = true;
      try {
        const { data } = await api.patch<SystemUser>(`/admin/users/${id}`, payload);
        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users[index] = data;
        }
        return data;
      } catch (err: unknown) {
        this.error = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.message || 'Failed to update user';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async toggleStatus(id: number) {
      this.loading = true;
      try {
        const { data } = await api.patch<SystemUser>(`/admin/users/${id}/status`);
        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users[index] = data;
        }
        return data;
      } catch (err: unknown) {
        this.error = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.message || 'Failed to toggle status';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async resetPassword(id: number) {
      this.loading = true;
      try {
        const { data } = await api.post<{ tempPassword?: string; newPassword?: string }>(`/admin/users/${id}/reset-password`);
        return data;
      } catch (err: unknown) {
        this.error = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.message || 'Failed to reset password';
        throw err;
      } finally {
        this.loading = false;
      }
    }
  }
});
