import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as userManagementController from '../controllers/userManagementController.js';

export const userManagementRoutes = Router();

// Protect all routes with auth and admin role
userManagementRoutes.use(requireAuth);
userManagementRoutes.use(requireRole('admin'));

userManagementRoutes.get('/', asyncHandler(userManagementController.listUsers));
userManagementRoutes.post('/', asyncHandler(userManagementController.createUser));
userManagementRoutes.patch('/:id', asyncHandler(userManagementController.updateUser));
userManagementRoutes.patch('/:id/status', asyncHandler(userManagementController.toggleUserStatus));
userManagementRoutes.post('/:id/reset-password', asyncHandler(userManagementController.adminResetPassword));

export default userManagementRoutes;
