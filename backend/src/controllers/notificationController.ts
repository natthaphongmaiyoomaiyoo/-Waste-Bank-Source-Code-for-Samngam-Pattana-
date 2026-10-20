import type { Request, Response } from 'express';
import * as notificationService from '../services/notificationService.js';
import { markNotificationsReadSchema } from '../validators/notificationValidators.js';

export async function list(req: Request, res: Response) {
  const notifications = await notificationService.list(req.auth!.userId);
  res.json(notifications);
}

export async function markRead(req: Request, res: Response) {
  const { ids } = markNotificationsReadSchema.parse(req.body);
  const result = await notificationService.markRead(req.auth!.userId, ids);
  res.json(result);
}
