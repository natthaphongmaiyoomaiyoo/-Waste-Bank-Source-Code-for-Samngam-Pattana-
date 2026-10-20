import type { Banner } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { UpdateBannerTextInput } from '../validators/bannerValidators.js';
import { deleteStoredObject, publicFileUrl, storeUpload } from './storageService.js';

// Banners are news-page imagery, so they share the public news bucket instead
// of needing another bucket provisioned in every environment.
const BUCKET = 'news';

// The built-in banners the migration inserted ("/icons/...") are served by the
// frontend itself, not by storage - pass them through and never delete them.
function isFrontendAsset(imageUrl: string): boolean {
  return imageUrl.startsWith('/');
}

function serialize(row: Banner) {
  return {
    id: row.id,
    imageUrl: isFrontendAsset(row.imageUrl) ? row.imageUrl : publicFileUrl(BUCKET, row.imageUrl),
    createdAt: row.createdAt,
    sortOrder: row.sortOrder,
    textIntro: row.textIntro,
    textMain: row.textMain,
  };
}

// In slideshow order, as the admin arranged it (ties: oldest first).
export async function list() {
  const rows = await prisma.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return rows.map(serialize);
}

export async function create(file: Express.Multer.File | undefined) {
  if (!file) throw ApiError.badRequest('image is required');

  const objectPath = await storeUpload(BUCKET, file);
  let row;
  try {
    // A new banner goes to the end of the slideshow.
    const last = await prisma.banner.aggregate({ _max: { sortOrder: true } });
    row = await prisma.banner.create({
      data: { imageUrl: objectPath, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
  } catch (error) {
    await deleteStoredObject(BUCKET, objectPath).catch(() => undefined);
    throw error;
  }
  return serialize(row);
}

// Blank means no line. Both lines blank = no text on the banner at all.
export function normalizeBannerText(input: UpdateBannerTextInput) {
  const line = (value: string | null | undefined) => {
    const text = value?.trim() ?? '';
    return text ? text : null;
  };
  return { textIntro: line(input.textIntro), textMain: line(input.textMain) };
}

export async function updateText(id: number, input: UpdateBannerTextInput) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Banner not found');
  const row = await prisma.banner.update({ where: { id }, data: normalizeBannerText(input) });
  return serialize(row);
}

// The new order must name every banner exactly once - a list that is stale
// (another admin added or removed one meanwhile) is refused, not half-applied.
export function assertSameBanners(existingIds: number[], orderedIds: number[]) {
  const unique = new Set(orderedIds);
  const sameSet =
    unique.size === orderedIds.length &&
    orderedIds.length === existingIds.length &&
    existingIds.every((id) => unique.has(id));
  if (!sameSet) {
    throw ApiError.conflict('รายการแบนเนอร์เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่แล้วจัดลำดับอีกครั้ง');
  }
}

export async function reorder(orderedIds: number[]) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.banner.findMany({ select: { id: true } });
    assertSameBanners(
      existing.map((row) => row.id),
      orderedIds,
    );
    for (const [index, id] of orderedIds.entries()) {
      await tx.banner.update({ where: { id }, data: { sortOrder: index + 1 } });
    }
    const rows = await tx.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    return rows.map(serialize);
  });
}

export async function remove(id: number) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Banner not found');

  await prisma.banner.delete({ where: { id } });
  if (!isFrontendAsset(existing.imageUrl)) {
    await deleteStoredObject(BUCKET, existing.imageUrl).catch(() => undefined);
  }
}
