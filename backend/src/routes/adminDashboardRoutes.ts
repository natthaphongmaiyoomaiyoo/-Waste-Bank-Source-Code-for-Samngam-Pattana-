import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as controller from '../controllers/adminDashboardController.js';

export const adminDashboardRoutes = Router();

adminDashboardRoutes.use(requireAuth, requireRole('admin'));
adminDashboardRoutes.get('/', asyncHandler(controller.getDashboardSummary));
adminDashboardRoutes.get('/eligibility', asyncHandler(controller.getMembersEligibility));
adminDashboardRoutes.get('/eligibility/:memberId', asyncHandler(controller.getMemberEligibility));

export default adminDashboardRoutes;
