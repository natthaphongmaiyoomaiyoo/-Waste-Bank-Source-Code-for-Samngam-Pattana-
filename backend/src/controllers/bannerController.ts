import type { Request, Response } from 'express';
import * as bannerService from '../services/bannerService.js';
import { reorderBannersSchema, updateBannerTextSchema } from '../validators/bannerValidators.js';

export async function list(_req: Request, res: Response) {
  res.json(await bannerService.list());
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await bannerService.create(req.file));
}

export async function updateText(req: Request, res: Response) {
  res.json(await bannerService.updateText(Number(req.params.id), updateBannerTextSchema.parse(req.body)));
}

export async function reorder(req: Request, res: Response) {
  const { ids } = reorderBannersSchema.parse(req.body);
  res.json(await bannerService.reorder(ids));
}

export async function remove(req: Request, res: Response) {
  await bannerService.remove(Number(req.params.id));
  res.status(204).send();
}
