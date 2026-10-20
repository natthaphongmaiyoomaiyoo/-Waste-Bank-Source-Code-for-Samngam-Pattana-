import { Router } from 'express';
import * as historyController from '../controllers/historyController.js';
import { requireAuth, requireActiveMember } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const historyRoutes = Router();

historyRoutes.use(requireAuth, requireRole('member'), requireActiveMember);
historyRoutes.get('/sales', asyncHandler(historyController.listSales));
historyRoutes.get('/sales/:id', asyncHandler(historyController.getSale));
