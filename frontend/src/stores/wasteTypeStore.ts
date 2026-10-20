import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';
import type { WasteTypes } from 'src/stores/models';

interface BackendWasteType {
  id: number;
  wasteName: string;
  unit: string;
  defaultPrice: number;
  status: string;
  proposedBy?: number | null;
  proposedAt?: string | null;
  reviewedAt?: string | null;
  rejectReason?: string | null;
  proposer?: { id: number; fullName: string; username: string } | null;
}

// A buyer-submitted waste type. Same fields as a catalog entry plus the review
// trail, so both the buyer and the admin can see where it stands.
export interface WasteTypeProposal extends WasteTypes {
  status: string;
  proposedAt: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  proposerName: string | null;
}

function toWasteType(row: BackendWasteType): WasteTypes {
  return {
    id: row.id,
    name: row.wasteName,
    price: row.defaultPrice,
    unit: row.unit,
    status: row.status,
  };
}

function toProposal(row: BackendWasteType): WasteTypeProposal {
  return {
    ...toWasteType(row),
    status: row.status,
    proposedAt: row.proposedAt ?? null,
    reviewedAt: row.reviewedAt ?? null,
    rejectReason: row.rejectReason ?? null,
    proposerName: row.proposer?.fullName ?? null,
  };
}

export const useWasteTypesStore = defineStore('wasteTypes', {
  state: () => ({
    wasteTypes: [] as WasteTypes[],
    // Buyer view: everything this account has proposed (any status).
    // Admin view: proposals waiting for a decision.
    proposals: [] as WasteTypeProposal[],
    loading: false,
    proposalsLoading: false,
    error: null as string | null,
  }),

  getters: {
    pendingProposals: (state) => state.proposals.filter((item) => item.status === 'pending'),
  },

  actions: {
    async fetchWasteTypes() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<BackendWasteType[]>('/waste-types');
        this.wasteTypes = data.map(toWasteType);
      } catch (error) {
        this.error = 'ไม่สามารถโหลดประเภทขยะได้';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async addWasteType(name: string, price: number, unit = 'kg') {
      const { data } = await api.post<BackendWasteType>('/waste-types', {
        wasteName: name,
        unit,
        defaultPrice: price,
      });

      this.wasteTypes.push(toWasteType(data));
    },

    async updateWasteType(id: number, name: string, price: number, unit = 'kg') {
      const { data } = await api.put<BackendWasteType>(`/waste-types/${id}`, {
        wasteName: name,
        unit,
        defaultPrice: price,
      });

      const wasteType = this.wasteTypes.find((item: WasteTypes) => item.id === id);
      if (wasteType) {
        Object.assign(wasteType, toWasteType(data));
      }
    },

    async deleteWasteType(id: number) {
      await api.delete(`/waste-types/${id}`);
      this.wasteTypes = this.wasteTypes.filter((item: WasteTypes) => item.id !== id);
    },

    // --- Buyer side ---

    // Submits a suggestion only: the type stays hidden from members until an
    // admin approves it, so nothing is pushed into `wasteTypes` here.
    async proposeWasteType(name: string, price: number, unit = 'kg') {
      const { data } = await api.post<BackendWasteType>('/waste-types/proposals', {
        wasteName: name,
        unit,
        defaultPrice: price,
      });

      this.proposals.unshift(toProposal(data));
    },

    async fetchOwnProposals() {
      this.proposalsLoading = true;
      try {
        const { data } = await api.get<BackendWasteType[]>('/waste-types/proposals/mine');
        this.proposals = data.map(toProposal);
      } finally {
        this.proposalsLoading = false;
      }
    },

    // --- Admin side ---

    async fetchProposals(status: 'pending' | 'all' = 'pending') {
      this.proposalsLoading = true;
      try {
        const { data } = await api.get<BackendWasteType[]>('/waste-types/proposals', {
          params: { status },
        });
        this.proposals = data.map(toProposal);
      } finally {
        this.proposalsLoading = false;
      }
    },

    async approveProposal(id: number, overrides?: { name?: string; price?: number; unit?: string }) {
      const { data } = await api.post<BackendWasteType>(`/waste-types/proposals/${id}/approve`, {
        ...(overrides?.name !== undefined ? { wasteName: overrides.name } : {}),
        ...(overrides?.unit !== undefined ? { unit: overrides.unit } : {}),
        ...(overrides?.price !== undefined ? { defaultPrice: overrides.price } : {}),
      });

      this.proposals = this.proposals.filter((item) => item.id !== id);
      this.wasteTypes.push(toWasteType(data));
    },

    async rejectProposal(id: number, reason: string) {
      await api.post(`/waste-types/proposals/${id}/reject`, { reason });
      this.proposals = this.proposals.filter((item) => item.id !== id);
    },
  },
});
