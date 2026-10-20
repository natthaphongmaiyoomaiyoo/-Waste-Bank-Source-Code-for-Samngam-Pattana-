import { Router } from 'express';
import * as memberController from '../controllers/memberController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const memberRoutes = Router();

memberRoutes.use(requireAuth, requireRole('member'));
memberRoutes.get('/profile', asyncHandler(memberController.getProfile));
memberRoutes.patch('/profile', asyncHandler(memberController.updateProfile));
