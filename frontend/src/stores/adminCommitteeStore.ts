import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

// Admin management of village-committee accounts ("กรรมการหมู่บ้าน").
// Wraps /api/admin/committees (backend/src/routes/adminCommitteeRoutes.ts).
// Villages come from the admin master data the admin maintains first
// (villageAreaStore) - a committee always belongs to exactly one of them.

export interface CommitteeVillage {
  id: number;
  villageName: string;
  moo: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  status: string;
}

export interface CommitteeAccount {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  status: string; // active | inactive
  lastLogin: string | null;
  mustChangePassword: boolean;
  avatarUrl: string | null;
  role: { id: number; roleName: string };
  villageArea: CommitteeVillage | null;
}

export interface CommitteeSummary {
  total: number;
  active: number;
  suspended: number;
  villagesWithCommittee: number;
  totalVillages: number;
  villagesWithoutCommittee: number;
}

export interface CommitteeFilters {
  search?: string | undefined;
  status?: string | undefined;
  villageAreaId?: number | undefined;
}

export interface CreateCommitteeInput {
  username: string;
  password: string;
  fullName: string;
  phone?: string | undefined;
  villageAreaId: number;
  status?: string | undefined;
}

export interface UpdateCommitteeInput {
  fullName?: string | undefined;
  phone?: string | undefined;
  villageAreaId?: number | undefined;
  status?: string | undefined;
  password?: string | undefined;
}

// Drops undefined / empty-string fields so the backend zod schemas treat them
// as absent rather than as a value to validate.
function cleanParams<T extends object>(params: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

export function committeeVillageLabel(village: CommitteeVillage | null): string {
  if (!village) return '-';
  return [village.moo ? `หมู่ ${village.moo}` : null, village.villageName]
    .filter(Boolean)
    .join(' - ');
}

export const useAdminCommitteeStore = defineStore('adminCommittee', {
  state: () => ({
    items: [] as CommitteeAccount[],
    summary: null as CommitteeSummary | null,
    loading: false,
    saving: false,
    error: null as string | null,
  }),

  actions: {
    async fetchCommittees(filters: CommitteeFilters = {}) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<{ items: CommitteeAccount[]; total: number }>(
          '/admin/committees',
          { params: cleanParams({ ...filters }) },
        );
        this.items = data.items;
        return data;
      } finally {
        this.loading = false;
      }
    },

    // Used by the add/edit form page when opened straight from a URL.
    async fetchCommittee(id: number) {
      const { data } = await api.get<CommitteeAccount>(`/admin/committees/${id}`);
      return data;
    },

    async fetchSummary() {
      const { data } = await api.get<CommitteeSummary>('/admin/committees/summary');
      this.summary = data;
      return data;
    },

    // Write actions throw on failure so pages can show the backend's message.
    async createCommittee(input: CreateCommitteeInput) {
      this.saving = true;
      try {
        const { data } = await api.post<CommitteeAccount>('/admin/committees', cleanParams(input));
        return data;
      } finally {
        this.saving = false;
      }
    },

    async updateCommittee(id: number, input: UpdateCommitteeInput) {
      this.saving = true;
      try {
        const { data } = await api.patch<CommitteeAccount>(
          `/admin/committees/${id}`,
          cleanParams(input),
        );
        return data;
      } finally {
        this.saving = false;
      }
    },

    async toggleStatus(id: number) {
      const { data } = await api.patch<CommitteeAccount>(`/admin/committees/${id}/status`);
      return data;
    },

    async deleteCommittee(id: number) {
      await api.delete(`/admin/committees/${id}`);
    },
  },
});
