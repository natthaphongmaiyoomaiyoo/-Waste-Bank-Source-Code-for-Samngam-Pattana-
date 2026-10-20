import type { Request, Response } from 'express';
import * as videoService from '../services/videoService.js';

// Multipart form fields arrive as strings; JSON bodies as booleans. Undefined = not sent.
const parseIsActive = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

export const listVideos = async (req: Request, res: Response) => {
  const activeOnly = req.query.active === '1' || req.query.active === 'true';
  const videos = await videoService.listVideos({ activeOnly });
  res.json({ success: true, data: videos });
};

export const getVideo = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const video = await videoService.getVideoById(id);
  res.json({ success: true, data: video });
};

export const createVideo = async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const video = await videoService.createVideo({
    ...req.body,
    isActive: parseIsActive(req.body.isActive),
  }, { video: files?.video?.[0], cover: files?.cover?.[0] });

  res.status(201).json({ success: true, data: video });
};

export const updateVideo = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  const payload = { ...req.body };

  const isActive = parseIsActive(req.body.isActive);
  if (isActive === undefined) {
    delete payload.isActive;
  } else {
    payload.isActive = isActive;
  }

  const video = await videoService.updateVideo(id, payload, { video: files?.video?.[0], cover: files?.cover?.[0] });
  res.json({ success: true, data: video });
};

export const deleteVideo = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await videoService.deleteVideo(id);
  res.json({ success: true, message: 'ลบวิดีโอเรียบร้อยแล้ว' });
};
