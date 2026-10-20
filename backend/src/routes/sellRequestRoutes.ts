import { Router } from 'express';
import * as sellRequestController from '../controllers/sellRequestController.js';
import { requireAuth, requireActiveMember } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const sellRequestRoutes = Router();

sellRequestRoutes.use(requireAuth, requireRole('member'), requireActiveMember);
sellRequestRoutes.post('/', asyncHandler(sellRequestController.create));
sellRequestRoutes.get('/', asyncHandler(sellRequestController.list));
sellRequestRoutes.get('/summary', asyncHandler(sellRequestController.summary));
sellRequestRoutes.patch('/:id/cancel', asyncHandler(sellRequestController.cancel));
