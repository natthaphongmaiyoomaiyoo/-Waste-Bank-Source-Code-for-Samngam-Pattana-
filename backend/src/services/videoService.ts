import type { WasteSortingVideo } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { publicPostedAtFilter, VIDEO_VISIBLE_DAYS_KEY } from './publicVisibilityService.js';
import { deleteStoredObject, publicFileUrl, storeUpload } from './storageService.js';

export interface CreateVideoPayload { title: string; description?: string | null; videoUrl?: string; coverUrl?: string | null; category?: string | null; isActive?: boolean; postedAt?: string | null; }
export interface UpdateVideoPayload { title?: string; description?: string | null; videoUrl?: string; coverUrl?: string | null; category?: string | null; isActive?: boolean; postedAt?: string | null; }
export interface VideoUploads { video?: Express.Multer.File; cover?: Express.Multer.File; }

function serialize(row: WasteSortingVideo) {
  return {
    ...row,
    videoUrl: publicFileUrl('videos', row.videoUrl) ?? row.videoUrl,
    coverUrl: publicFileUrl('videos', row.coverUrl),
  };
}

async function rawById(id: number) {
  const video = await prisma.wasteSortingVideo.findUnique({ where: { id } });
  if (!video) throw ApiError.notFound('Video not found');
  return video;
}

// activeOnly = public site: published videos inside the video.visibleDays window.
export async function listVideos(options?: { activeOnly?: boolean }) {
  const rows = await prisma.wasteSortingVideo.findMany({ ...(options?.activeOnly ? { where: { isActive: true, postedAt: await publicPostedAtFilter(VIDEO_VISIBLE_DAYS_KEY) } } : {}), orderBy: { postedAt: 'desc' } });
  return rows.map(serialize);
}

export async function getVideoById(id: number) { return serialize(await rawById(id)); }

export async function createVideo(payload: CreateVideoPayload, uploads: VideoUploads = {}) {
  if (!payload.title?.trim()) throw ApiError.badRequest('Video title is required');
  if (!payload.videoUrl?.trim() && !uploads.video) throw ApiError.badRequest('Video URL or file is required');
  const stored: Array<{ kind: 'video' | 'cover'; path: string }> = [];
  try {
    if (uploads.video) stored.push({ kind: 'video', path: await storeUpload('videos', uploads.video) });
    if (uploads.cover) stored.push({ kind: 'cover', path: await storeUpload('videos', uploads.cover) });
    const videoPath = stored.find((item) => item.kind === 'video')?.path ?? payload.videoUrl!.trim();
    const coverPath = (stored.find((item) => item.kind === 'cover')?.path ?? payload.coverUrl?.trim()) || null;
    const row = await prisma.wasteSortingVideo.create({ data: { title: payload.title.trim(), description: payload.description?.trim() || null, videoUrl: videoPath, coverUrl: coverPath, category: payload.category?.trim() || null, isActive: payload.isActive ?? true, postedAt: payload.postedAt ? new Date(payload.postedAt) : new Date() } });
    return serialize(row);
  } catch (error) {
    await Promise.all(stored.map((item) => deleteStoredObject('videos', item.path).catch(() => undefined)));
    throw error;
  }
}

export async function updateVideo(id: number, payload: UpdateVideoPayload, uploads: VideoUploads = {}) {
  const existing = await rawById(id);
  const stored: Array<{ kind: 'video' | 'cover'; path: string }> = [];
  try {
    if (uploads.video) stored.push({ kind: 'video', path: await storeUpload('videos', uploads.video) });
    if (uploads.cover) stored.push({ kind: 'cover', path: await storeUpload('videos', uploads.cover) });
    const data: Record<string, unknown> = {};
    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.description !== undefined) data.description = payload.description?.trim() || null;
    if (payload.videoUrl !== undefined) data.videoUrl = payload.videoUrl.trim();
    if (payload.coverUrl !== undefined) data.coverUrl = payload.coverUrl?.trim() || null;
    if (payload.category !== undefined) data.category = payload.category?.trim() || null;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;
    if (payload.postedAt !== undefined) data.postedAt = payload.postedAt ? new Date(payload.postedAt) : new Date();
    const newVideo = stored.find((item) => item.kind === 'video')?.path;
    const newCover = stored.find((item) => item.kind === 'cover')?.path;
    if (newVideo) data.videoUrl = newVideo;
    if (newCover) data.coverUrl = newCover;
    const row = await prisma.wasteSortingVideo.update({ where: { id }, data });
    if (newVideo) await deleteStoredObject('videos', existing.videoUrl).catch(() => undefined);
    if (newCover) await deleteStoredObject('videos', existing.coverUrl).catch(() => undefined);
    return serialize(row);
  } catch (error) {
    await Promise.all(stored.map((item) => deleteStoredObject('videos', item.path).catch(() => undefined)));
    throw error;
  }
}

export async function deleteVideo(id: number) {
  const existing = await rawById(id);
  await prisma.wasteSortingVideo.delete({ where: { id } });
  await Promise.all([deleteStoredObject('videos', existing.videoUrl).catch(() => undefined), deleteStoredObject('videos', existing.coverUrl).catch(() => undefined)]);
}
