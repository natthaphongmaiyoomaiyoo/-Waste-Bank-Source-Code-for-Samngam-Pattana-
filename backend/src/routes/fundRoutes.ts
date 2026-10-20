import { Router } from 'express';
import * as fundController from '../controllers/fundController.js';
import { requireAuth, requireActiveMember } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const fundRoutes = Router();

fundRoutes.use(requireAuth, requireRole('member'), requireActiveMember);
fundRoutes.get('/balance', asyncHandler(fundController.getBalance));
fundRoutes.get('/transactions', asyncHandler(fundController.listTransactions));
