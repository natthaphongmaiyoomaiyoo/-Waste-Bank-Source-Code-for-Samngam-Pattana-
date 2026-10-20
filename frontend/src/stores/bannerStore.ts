import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

// Shape returned by GET /banners (backend/src/services/bannerService.ts), in
// slideshow order. imageUrl is either an absolute storage URL or a frontend
// static path. textIntro / textMain: the optional text over the banner - its
// first and second line (null = no line).
export interface Banner {
  id: number;
  imageUrl: string;
  createdAt: string;
  sortOrder: number;
  textIntro: string | null;
  textMain: string | null;
}

export interface BannerText {
  textIntro: string | null;
  textMain: string | null;
}

export const useBannerStore = defineStore('banner', {
  state: () => ({
    items: [] as Banner[],
    loading: false,
    // true once the first request settles (success or not), so the homepage can
    // tell "still loading" apart from "no banners" before choosing a fallback.
    loaded: false,
    error: null as string | null,
  }),

  actions: {
    async fetchBanners() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<Banner[]>('/banners');
        this.items = data;
      } catch {
        this.error = 'ไม่สามารถโหลดแบนเนอร์ได้ กรุณาลองใหม่อีกครั้ง';
      } finally {
        this.loading = false;
        this.loaded = true;
      }
    },

    async addBanner(file: File) {
      const body = new FormData();
      body.append('image', file);
      await api.post('/banners', body);
      await this.fetchBanners();
    },

    // Blank lines clear; both blank removes the text from the banner.
    async updateBannerText(id: number, text: BannerText) {
      await api.patch(`/banners/${id}`, text);
      await this.fetchBanners();
    },

    // Every banner id in the new slideshow order. Shown at once; if the server
    // refuses (the list changed meanwhile), the real order is loaded back.
    async reorderBanners(ids: number[]) {
      const byId = new Map(this.items.map((banner) => [banner.id, banner]));
      this.items = ids.map((id) => byId.get(id)).filter((banner): banner is Banner => !!banner);
      try {
        const { data } = await api.put<Banner[]>('/banners/order', { ids });
        this.items = data;
      } catch (error) {
        await this.fetchBanners();
        throw error;
      }
    },

    async removeBanner(id: number) {
      await api.delete(`/banners/${id}`);
      await this.fetchBanners();
    },
  },
});
