import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

export interface VillageArea {
  id: number;
  villageName: string;
  moo: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postcode: string | null;
  status: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function villageAreaLabel(area: VillageArea) {
  const parts = [
    area.moo ? `หมู่ ${area.moo}` : null,
    area.villageName,
    area.subdistrict ? `ต.${area.subdistrict}` : null,
  ].filter(Boolean);

  return parts.join(' - ');
}

export function villageAreaValue(area: VillageArea) {
  return area.moo ?? area.villageName;
}

export function villageMooOptions(areas: VillageArea[]) {
  const uniqueMoos = [...new Set(areas.map((area) => area.moo).filter((moo): moo is string => Boolean(moo)))];

  return uniqueMoos
    .sort((a, b) => a.localeCompare(b, 'th', { numeric: true }))
    .map((moo) => ({
      label: `หมู่ ${moo}`,
      value: moo,
    }));
}

export const useVillageAreaStore = defineStore('villageAreas', {
  state: () => ({
    items: [] as VillageArea[],
    loading: false,
    loaded: false,
  }),

  actions: {
    async fetchActive() {
      if (this.loading) return this.items;

      this.loading = true;
      try {
        const { data } = await api.get<Paginated<VillageArea>>('/master-data/village-areas', {
          params: { page: 1, pageSize: 100 },
        });
        this.items = data.items;
        this.loaded = true;
        return this.items;
      } finally {
        this.loading = false;
      }
    },
  },
});
