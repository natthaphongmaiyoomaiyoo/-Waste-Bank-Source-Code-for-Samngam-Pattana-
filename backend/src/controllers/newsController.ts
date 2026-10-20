import type { Request, Response } from 'express';
import * as newsService from '../services/newsService.js';
import { createNewsSchema, updateNewsSchema } from '../validators/newsValidators.js';

export async function list(req: Request, res: Response) {
  const visibleOnly = req.query.visible === '1' || req.query.visible === 'true';
  res.json(await newsService.list({ visibleOnly }));
}

export async function getOne(req: Request, res: Response) {
  res.json(await newsService.getById(Number(req.params.id)));
}

export async function create(req: Request, res: Response) {
  const input = createNewsSchema.parse(req.body);
  res.status(201).json(await newsService.create(input, req.file));
}

export async function update(req: Request, res: Response) {
  const input = updateNewsSchema.parse(req.body);
  res.json(await newsService.update(Number(req.params.id), input, req.file));
}

export async function remove(req: Request, res: Response) {
  await newsService.remove(Number(req.params.id));
  res.status(204).send();
}
