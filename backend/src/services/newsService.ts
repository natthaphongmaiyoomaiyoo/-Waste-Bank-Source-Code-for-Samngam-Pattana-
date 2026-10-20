import type { News } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { NEWS_VISIBLE_DAYS_KEY, publicPostedAtFilter } from './publicVisibilityService.js';
import { deleteStoredObject, publicFileUrl, storeUpload } from './storageService.js';
import type { CreateNewsInput, UpdateNewsInput } from '../validators/newsValidators.js';

function serialize(row: News) {
  return { ...row, imageUrl: publicFileUrl('news', row.imageUrl) };
}

// visibleOnly = public site (homepage, all-news page); admin management loads everything.
export async function list(options?: { visibleOnly?: boolean }) {
  const rows = await prisma.news.findMany({
    ...(options?.visibleOnly ? { where: { postedAt: await publicPostedAtFilter(NEWS_VISIBLE_DAYS_KEY) } } : {}),
    orderBy: { postedAt: 'desc' },
  });
  return rows.map(serialize);
}

export async function getById(id: number) {
  const row = await prisma.news.findUnique({ where: { id } });
  if (!row) throw ApiError.notFound('News not found');
  return serialize(row);
}

export async function create(input: CreateNewsInput, file: Express.Multer.File | undefined) {
  if (!file) throw ApiError.badRequest('image is required');

  const objectPath = await storeUpload('news', file);
  let row;
  try {
    row = await prisma.news.create({ data: { title: input.title, details: input.details, postedAt: new Date(input.postedAt), imageUrl: objectPath } });
  } catch (error) {
    await deleteStoredObject('news', objectPath).catch(() => undefined);
    throw error;
  }
  return serialize(row);
}

export async function update(id: number, input: UpdateNewsInput, file: Express.Multer.File | undefined) {
  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('News not found');

  const objectPath = file ? await storeUpload('news', file) : undefined;
  let row;
  try { row = await prisma.news.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.details !== undefined ? { details: input.details } : {}),
      ...(input.postedAt !== undefined ? { postedAt: new Date(input.postedAt) } : {}),
      ...(objectPath ? { imageUrl: objectPath } : {}),
    },
  }); } catch (error) {
    await deleteStoredObject('news', objectPath).catch(() => undefined);
    throw error;
  }

  // Best-effort cleanup of the replaced file - not worth failing the request over.
  if (file) await deleteStoredObject('news', existing.imageUrl).catch(() => undefined);

  return serialize(row);
}

export async function remove(id: number) {
  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('News not found');

  await prisma.news.delete({ where: { id } });
  await deleteStoredObject('news', existing.imageUrl).catch(() => undefined);
}
