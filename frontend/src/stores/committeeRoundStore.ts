import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

// Collection rounds ("รอบรับซื้อขยะ") the village committee schedules for its
// own village. Wraps /api/committee/rounds - the backend stamps the committee's
// village on every round it creates and only that village's members are offered
// it, so nothing here needs to send a village.

export interface RoundBuyer {
  id: number;
  buyerName: string;
  phone: string | null;
}

export interface CommitteeRound {
  id: number;
  roundDate: string;
  startTime: string;
  endTime: string;
  locationNote: string | null;
  status: 'planned' | 'completed' | 'cancelled';
  buyerId: number;
  buyer: RoundBuyer;
  // null = รอบกลางของเทศบาล (created by an admin) - visible but not editable.
  villageArea: { id: number; villageName: string; moo: string | null } | null;
  _count?: { saleRequests: number };
}

export interface RoundSummary {
  total: number;
  planned: number;
  completed: number;
  cancelled: number;
}

export interface RoundFilters {
  status?: string | undefined;
  scope?: 'upcoming' | 'all' | undefined;
  // Leave out the municipality-wide rounds (see committeeRoundListQuerySchema).
  ownVillageOnly?: boolean | undefined;
  villageAreaId?: number | undefined;
}

// One page of the round tables. `search` matches the Thai date, times, buyer,
// meeting point and village on the server.
export interface RoundPageFilters extends RoundFilters {
  page: number;
  pageSize: number;
  search?: string | undefined;
  descending?: boolean | undefined;
}

export interface RoundInput {
  roundDate: string;
  startTime: string;
  endTime: string;
  buyerId: number;
  locationNote?: string | undefined;
}

function cleanParams<T extends object>(params: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

export const useCommitteeRoundStore = defineStore('committeeRounds', {
  state: () => ({
    items: [] as CommitteeRound[],
    // Rows matching the last fetchRoundsPage filters, across every page.
    pageTotal: 0,
    buyers: [] as RoundBuyer[],
    summary: null as RoundSummary | null,
    loading: false,
    saving: false,
  }),

  actions: {
    async fetchRounds(filters: RoundFilters = {}) {
      this.loading = true;
      try {
        const { data } = await api.get<{ items: CommitteeRound[]; total: number }>(
          '/committee/rounds',
          { params: cleanParams(filters) },
        );
        this.items = data.items;
        return data;
      } finally {
        this.loading = false;
      }
    },

    // The round tables: one page instead of every round ever held.
    async fetchRoundsPage(filters: RoundPageFilters) {
      this.loading = true;
      try {
        const { data } = await api.get<{ items: CommitteeRound[]; total: number }>(
          '/committee/rounds',
          { params: cleanParams(filters) },
        );
        this.items = data.items;
        this.pageTotal = data.total;
        return data;
      } finally {
        this.loading = false;
      }
    },

    async fetchRound(roundId: number) {
      const { data } = await api.get<CommitteeRound>(`/committee/rounds/${roundId}`);
      return data;
    },

    async fetchSummary(filters: RoundFilters = {}) {
      const { data } = await api.get<RoundSummary>('/committee/rounds/summary', {
        params: cleanParams(filters),
      });
      this.summary = data;
      return data;
    },

    async fetchBuyers() {
      const { data } = await api.get<RoundBuyer[]>('/committee/buyers');
      this.buyers = data;
      return data;
    },

    // Write actions throw so the page can show the backend's own message.
    async createRound(input: RoundInput) {
      this.saving = true;
      try {
        const { data } = await api.post<CommitteeRound>('/committee/rounds', cleanParams(input));
        return data;
      } finally {
        this.saving = false;
      }
    },

    async updateRound(roundId: number, input: Partial<RoundInput>) {
      this.saving = true;
      try {
        const { data } = await api.patch<CommitteeRound>(`/committee/rounds/${roundId}`, {
          ...cleanParams(input),
          // An explicit '' means "clear the note" - keep it past cleanParams,
          // which would otherwise drop it and leave the old note in place.
          ...(input.locationNote === '' ? { locationNote: '' } : {}),
        });
        return data;
      } finally {
        this.saving = false;
      }
    },

    async cancelRound(roundId: number) {
      const { data } = await api.patch<CommitteeRound>(`/committee/rounds/${roundId}/cancel`);
      return data;
    },

    async completeRound(roundId: number) {
      const { data } = await api.patch<CommitteeRound>(`/committee/rounds/${roundId}/complete`);
      return data;
    },
  },
});
