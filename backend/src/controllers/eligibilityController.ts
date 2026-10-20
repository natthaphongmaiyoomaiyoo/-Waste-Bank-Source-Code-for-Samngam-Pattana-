import type { Request, Response } from 'express';
import * as eligibilityService from '../services/eligibilityService.js';

export async function check(req: Request, res: Response) {
  const result = await eligibilityService.getMemberEligibility(req.auth!.memberId!);
  res.json(result);
}
