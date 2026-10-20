import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';
import { THAI_MONTHS, type NewsItem } from 'src/data/news';

// Shape returned by GET /news, GET /news/:id (backend/src/services/newsService.ts).
// imageUrl is already an absolute URL - no URL-joining needed here.
interface BackendNews {
  id: number;
  title: string;
  details: string;
  imageUrl: string;
  postedAt: string; // ISO date string
}

// Both sides work in UTC (see ManageNewPage.vue's date conversion), so a date
// picked in Thailand round-trips through the backend without shifting a day.
function toDisplayDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function mapNews(row: BackendNews): NewsItem {
  return { id: row.id, date: toDisplayDate(row.postedAt), title: row.title, details: row.details, image: row.imageUrl };
}

function getDateValue(dateStr: string): number {
  const [d, m, y] = dateStr.split('/').map(Number);
  if (!d || !m || !y) return 0;
  return y * 10000 + m * 100 + d;
}

export function formatThaiDate(dateString: string): string {
  const [d, m, y] = dateString.split('/');
  if (!d || !m || !y) return dateString;
  const month = THAI_MONTHS[Number(m) - 1];
  if (!month) return dateString;

  return `${Number(d)} ${month} ${Number(y) + 543}`;
}

export const useNewsStore = defineStore('news', {
  state: () => ({
    items: [] as NewsItem[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    getById: (state) => (id: number) => state.items.find((item) => item.id === id) ?? null,
  },

  actions: {
    // visibleOnly: true = public pages (server applies the news.visibleDays window) /
    // false = everything, for the admin management page.
    async fetchNews(options?: { visibleOnly?: boolean }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<BackendNews[]>('/news', {
          params: options?.visibleOnly ? { visible: '1' } : {},
        });
        this.items = data.map(mapNews).sort((a, b) => getDateValue(b.date) - getDateValue(a.date));
      } catch {
        this.error = 'ไม่สามารถโหลดข่าวสารได้ กรุณาลองใหม่อีกครั้ง';
      } finally {
        this.loading = false;
      }
    },
  },
});
