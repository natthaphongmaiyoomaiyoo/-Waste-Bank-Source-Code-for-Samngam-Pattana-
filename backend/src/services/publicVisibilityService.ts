import { prisma } from '../database/prisma.js';

// SystemSetting keys (editable in Admin > Master Data > ตั้งค่าระบบ). Value is
// how many most-recent days (today included) the public site shows; a missing
// row, 0, or a non-number means no age limit.
export const NEWS_VISIBLE_DAYS_KEY = 'news.visibleDays';
export const VIDEO_VISIBLE_DAYS_KEY = 'video.visibleDays';

const DAY_MS = 24 * 60 * 60 * 1000;
const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * postedAt range for a public listing: hides posts dated after today (scheduled
 * ahead by the admin) and, when `visibleDays` > 0, posts older than that window.
 * Admin-picked dates are stored as UTC midnight of the Thai calendar day (see
 * ManageNewPage.vue), so "today" is computed on that same grid.
 */
export function postedAtWindow(visibleDays: number, now = new Date()) {
  const thaiNow = new Date(now.getTime() + THAILAND_OFFSET_MS);
  const today = Date.UTC(thaiNow.getUTCFullYear(), thaiNow.getUTCMonth(), thaiNow.getUTCDate());
  const days = Number.isFinite(visibleDays) ? Math.floor(visibleDays) : 0;

  return {
    lt: new Date(today + DAY_MS),
    ...(days > 0 ? { gte: new Date(today - (days - 1) * DAY_MS) } : {}),
  };
}

export async function publicPostedAtFilter(settingKey: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { settingKey } });
  return postedAtWindow(Number(setting?.settingValue));
}
