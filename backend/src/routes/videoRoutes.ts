import { Router } from 'express';
import * as videoController from '../controllers/videoController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadVideoMedia } from '../middleware/upload.js';

export const videoRoutes = Router();

// Public / Member read routes
videoRoutes.get('/', asyncHandler(videoController.listVideos));
videoRoutes.get('/:id', asyncHandler(videoController.getVideo));

// Admin write routes
videoRoutes.post('/', requireAuth, requireRole('admin'), uploadVideoMedia, asyncHandler(videoController.createVideo));
videoRoutes.put('/:id', requireAuth, requireRole('admin'), uploadVideoMedia, asyncHandler(videoController.updateVideo));
videoRoutes.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(videoController.deleteVideo));
