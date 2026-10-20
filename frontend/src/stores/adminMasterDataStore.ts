import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MemberTypeMaster {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerMaster {
  id: number;
  buyerName: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  status: string;
}

export interface VillageAreaMaster {
  id: number;
  villageName: string;
  moo: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postcode: string | null;
  status: string;
}

export interface FundAccountMaster {
  id: number;
  accountName: string;
  balance: number;
  updatedAt: string;
}

export interface RoleMaster {
  id: number;
  roleName: string;
  description: string | null;
}

export interface SystemSettingMaster {
  id: number;
  settingKey: string;
  settingValue: string;
  valueType: string;
  description: string | null;
  updatedBy: number | null;
  updatedAt: string;
}

export interface WastePriceHistoryMaster {
  id: number;
  wasteTypeId: number;
  buyerId: number | null;
  price: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: number | null;
  createdAt: string;
  wasteType: { id: number; wasteName: string; unit: string; defaultPrice: number; status: string };
  buyer: BuyerMaster | null;
}

export interface MasterFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  wasteTypeId?: number;
  buyerId?: number;
  // Column to sort on (the list's own order breaks ties); see adminMasterDataService.
  sortBy?: string | undefined;
  descending?: boolean | undefined;
}

type MasterList = 'buyers' | 'villageAreas' | 'fundAccounts' | 'settings' | 'priceHistory';

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export const useAdminMasterDataStore = defineStore('adminMasterData', {
  state: () => ({
    buyers: null as Paginated<BuyerMaster> | null,
    villageAreas: null as Paginated<VillageAreaMaster> | null,
    fundAccounts: null as Paginated<FundAccountMaster> | null,
    settings: null as Paginated<SystemSettingMaster> | null,
    priceHistory: null as Paginated<WastePriceHistoryMaster> | null,
    roles: [] as RoleMaster[],
    memberTypes: [] as MemberTypeMaster[],
    // The page/sort/search each table last asked for, so the reload after a save
    // or delete (fetchX() with no argument) stays on the page being looked at.
    lastQuery: {} as Partial<Record<MasterList, MasterFilters>>,
    loading: false,
  }),

  actions: {
    async fetchBuyers(filters?: MasterFilters) {
      const query = filters ?? this.lastQuery.buyers ?? {};
      this.lastQuery.buyers = query;
      this.loading = true;
      try {
        const { data } = await api.get<Paginated<BuyerMaster>>('/admin/master-data/buyers', {
          params: cleanParams({ page: 1, pageSize: 50, ...query }),
        });
        this.buyers = data;
        return data;
      } finally {
        this.loading = false;
      }
    },

    async saveBuyer(input: Partial<BuyerMaster> & { buyerName: string }) {
      if (input.id) {
        const { data } = await api.put<BuyerMaster>(`/admin/master-data/buyers/${input.id}`, input);
        await this.fetchBuyers();
        return data;
      }
      const { data } = await api.post<BuyerMaster>('/admin/master-data/buyers', input);
      await this.fetchBuyers();
      return data;
    },

    async deleteBuyer(id: number) {
      await api.delete(`/admin/master-data/buyers/${id}`);
      await this.fetchBuyers();
    },

    async fetchVillageAreas(filters?: MasterFilters) {
      const query = filters ?? this.lastQuery.villageAreas ?? {};
      this.lastQuery.villageAreas = query;
      this.loading = true;
      try {
        const { data } = await api.get<Paginated<VillageAreaMaster>>('/admin/master-data/village-areas', {
          params: cleanParams({ page: 1, pageSize: 50, ...query }),
        });
        this.villageAreas = data;
        return data;
      } finally {
        this.loading = false;
      }
    },

    async saveVillageArea(input: Partial<VillageAreaMaster> & { villageName: string }) {
      if (input.id) {
        const { data } = await api.put<VillageAreaMaster>(`/admin/master-data/village-areas/${input.id}`, input);
        await this.fetchVillageAreas();
        return data;
      }
      const { data } = await api.post<VillageAreaMaster>('/admin/master-data/village-areas', input);
      await this.fetchVillageAreas();
      return data;
    },

    async deleteVillageArea(id: number) {
      await api.delete(`/admin/master-data/village-areas/${id}`);
      await this.fetchVillageAreas();
    },

    async fetchFundAccounts(filters?: MasterFilters) {
      const query = filters ?? this.lastQuery.fundAccounts ?? {};
      this.lastQuery.fundAccounts = query;
      this.loading = true;
      try {
        const { data } = await api.get<Paginated<FundAccountMaster>>('/admin/master-data/fund-accounts', {
          params: cleanParams({ page: 1, pageSize: 50, ...query }),
        });
        this.fundAccounts = data;
        return data;
      } finally {
        this.loading = false;
      }
    },

    async saveFundAccount(input: Partial<FundAccountMaster> & { accountName: string }) {
      if (input.id) {
        const { data } = await api.put<FundAccountMaster>(`/admin/master-data/fund-accounts/${input.id}`, input);
        await this.fetchFundAccounts();
        return data;
      }
      const { data } = await api.post<FundAccountMaster>('/admin/master-data/fund-accounts', input);
      await this.fetchFundAccounts();
      return data;
    },

    async fetchRoles() {
      this.loading = true;
      try {
        const { data } = await api.get<RoleMaster[]>('/admin/master-data/roles');
        this.roles = data;
        return data;
      } finally {
        this.loading = false;
      }
    },

    async saveRole(input: { id?: number; roleName: string; description?: string }) {
      if (input.id) {
        const { data } = await api.put<RoleMaster>(`/admin/master-data/roles/${input.id}`, input);
        await this.fetchRoles();
        return data;
      }
      const { data } = await api.post<RoleMaster>('/admin/master-data/roles', input);
      await this.fetchRoles();
      return data;
    },

    async deleteRole(id: number) {
      await api.delete(`/admin/master-data/roles/${id}`);
      await this.fetchRoles();
    },

    async fetchSettings(filters?: MasterFilters) {
      const query = filters ?? this.lastQuery.settings ?? {};
      this.lastQuery.settings = query;
      this.loading = true;
      try {
        const { data } = await api.get<Paginated<SystemSettingMaster>>('/admin/master-data/settings', {
          params: cleanParams({ page: 1, pageSize: 50, ...query }),
        });
        this.settings = data;
        return data;
      } finally {
        this.loading = false;
      }
    },

    async saveSetting(input: Partial<SystemSettingMaster> & { settingKey: string; settingValue: string }) {
      const { data } = await api.post<SystemSettingMaster>('/admin/master-data/settings', input);
      await this.fetchSettings();
      return data;
    },

    async deleteSetting(id: number) {
      await api.delete(`/admin/master-data/settings/${id}`);
      await this.fetchSettings();
    },

    async fetchMemberTypes() {
      this.loading = true;
      try {
        const { data } = await api.get<MemberTypeMaster[]>('/admin/master-data/member-types');
        this.memberTypes = data;
        return data;
      } finally {
        this.loading = false;
      }
    },

    async saveMemberType(input: { id?: number; name: string; description?: string; isActive?: boolean }) {
      if (input.id) {
        const { data } = await api.put<MemberTypeMaster>(`/admin/master-data/member-types/${input.id}`, input);
        await this.fetchMemberTypes();
        return data;
      }
      const { data } = await api.post<MemberTypeMaster>('/admin/master-data/member-types', input);
      await this.fetchMemberTypes();
      return data;
    },

    async deleteMemberType(id: number) {
      await api.delete(`/admin/master-data/member-types/${id}`);
      await this.fetchMemberTypes();
    },

    async fetchPriceHistory(filters?: MasterFilters) {
      const query = filters ?? this.lastQuery.priceHistory ?? {};
      this.lastQuery.priceHistory = query;
      this.loading = true;
      try {
        const { data } = await api.get<Paginated<WastePriceHistoryMaster>>(
          '/admin/master-data/waste-price-history',
          { params: cleanParams({ page: 1, pageSize: 50, ...query }) },
        );
        this.priceHistory = data;
        return data;
      } finally {
        this.loading = false;
      }
    },

    async createPriceHistory(input: {
      wasteTypeId: number;
      buyerId?: number;
      price: number;
      effectiveFrom: string;
      effectiveTo?: string;
    }) {
      const { data } = await api.post<WastePriceHistoryMaster>(
        '/admin/master-data/waste-price-history',
        cleanParams(input),
      );
      await this.fetchPriceHistory();
      return data;
    },
  },
});
