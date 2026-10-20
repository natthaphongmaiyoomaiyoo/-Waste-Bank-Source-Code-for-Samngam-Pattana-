import { Router } from 'express';
import * as newsController from '../controllers/newsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadNewsImage } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const newsRoutes = Router();

// Public - the homepage and /news/:id must work for logged-out visitors too.
newsRoutes.get('/', asyncHandler(newsController.list));
newsRoutes.get('/:id', asyncHandler(newsController.getOne));

// requireAuth/requireRole run before uploadNewsImage deliberately - an
// unauthorized/forbidden request is rejected before any disk write happens.
newsRoutes.post('/', requireAuth, requireRole('admin'), uploadNewsImage, asyncHandler(newsController.create));
newsRoutes.put('/:id', requireAuth, requireRole('admin'), uploadNewsImage, asyncHandler(newsController.update));
newsRoutes.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(newsController.remove));
