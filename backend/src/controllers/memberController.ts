import type { Request, Response } from 'express';
import * as memberService from '../services/memberService.js';
import { updateProfileSchema } from '../validators/memberValidators.js';

export async function getProfile(req: Request, res: Response) {
  const member = await memberService.getProfile(req.auth!.memberId!);
  res.json(member);
}

export async function updateProfile(req: Request, res: Response) {
  const input = updateProfileSchema.parse(req.body);
  const member = await memberService.updateProfile(req.auth!.memberId!, input);
  res.json(member);
}
