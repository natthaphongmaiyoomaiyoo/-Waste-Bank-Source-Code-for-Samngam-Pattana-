import { Router } from 'express';
import * as bannerController from '../controllers/bannerController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadBannerImage } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const bannerRoutes = Router();

// Public - the homepage slideshow must work for logged-out visitors too.
bannerRoutes.get('/', asyncHandler(bannerController.list));

// requireAuth/requireRole run before uploadBannerImage deliberately - an
// unauthorized/forbidden request is rejected before any upload is parsed.
bannerRoutes.post('/', requireAuth, requireRole('admin'), uploadBannerImage, asyncHandler(bannerController.create));
bannerRoutes.put('/order', requireAuth, requireRole('admin'), asyncHandler(bannerController.reorder));
bannerRoutes.patch('/:id', requireAuth, requireRole('admin'), asyncHandler(bannerController.updateText));
bannerRoutes.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(bannerController.remove));
