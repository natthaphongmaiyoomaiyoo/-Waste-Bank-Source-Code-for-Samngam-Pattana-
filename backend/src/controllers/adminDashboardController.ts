import { Request, Response } from 'express';
import * as adminDashboardService from '../services/adminDashboardService.js';
import * as eligibilityService from '../services/eligibilityService.js';
import { ApiError } from '../utils/ApiError.js';

export const getDashboardSummary = async (_req: Request, res: Response) => {
  const data = await adminDashboardService.getAdminDashboardSummary();
  res.json(data);
};

// Eligibility overview of every active member (batch - no snapshot rows).
export const getMembersEligibility = async (_req: Request, res: Response) => {
  const data = await eligibilityService.checkAllMembersEligibility();
  res.json(data);
};

// Full re-check of one member; records an eligibility_check snapshot row with
// the admin's user id as checked_by.
export const getMemberEligibility = async (req: Request, res: Response) => {
  const memberId = Number(req.params.memberId);
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw ApiError.badRequest('Invalid member id');
  }
  const data = await eligibilityService.checkMemberEligibility(memberId, {
    checkedBy: req.auth?.userId,
  });
  res.json(data);
};
