import type { Request, Response } from 'express';
import * as scheduleService from '../services/scheduleService.js';

export async function listUpcoming(req: Request, res: Response) {
  const rounds = await scheduleService.listUpcoming({
    memberId: req.auth?.memberId ?? null,
    roleName: req.auth?.roleName ?? '',
  });
  res.json(rounds);
}
