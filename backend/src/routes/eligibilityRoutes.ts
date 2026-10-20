import { Router } from 'express';
import * as eligibilityController from '../controllers/eligibilityController.js';
import { requireAuth, requireActiveMember } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const eligibilityRoutes = Router();

eligibilityRoutes.use(requireAuth, requireRole('member'), requireActiveMember);
eligibilityRoutes.get('/', asyncHandler(eligibilityController.check));
