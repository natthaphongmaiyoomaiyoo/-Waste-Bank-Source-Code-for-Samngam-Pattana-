import { Router } from 'express';
import * as scheduleController from '../controllers/scheduleController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const scheduleRoutes = Router();

scheduleRoutes.use(requireAuth);
scheduleRoutes.get('/', asyncHandler(scheduleController.listUpcoming));
