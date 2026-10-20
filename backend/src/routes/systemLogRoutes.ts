import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as systemLogController from '../controllers/systemLogController.js';

export const systemLogRoutes = Router();

systemLogRoutes.use(requireAuth);
systemLogRoutes.use(requireRole('admin'));

systemLogRoutes.get('/', asyncHandler(systemLogController.getLogs));

export default systemLogRoutes;
