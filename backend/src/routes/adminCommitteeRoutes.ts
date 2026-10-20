import { Router } from 'express';
import * as adminCommitteeController from '../controllers/adminCommitteeController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Admin-only CRUD for village-committee accounts ("กรรมการหมู่บ้าน").
// The villages themselves are admin master data (/admin/master-data/village-areas)
// and must exist before a committee can be bound to one.
export const adminCommitteeRoutes = Router();

adminCommitteeRoutes.use(requireAuth, requireRole('admin'));

// Route order matters: /summary before /:id-style routes.
adminCommitteeRoutes.get('/summary', asyncHandler(adminCommitteeController.getCommitteeSummary));
adminCommitteeRoutes.get('/', asyncHandler(adminCommitteeController.listCommittees));
adminCommitteeRoutes.get('/:id', asyncHandler(adminCommitteeController.getCommittee));
adminCommitteeRoutes.post('/', asyncHandler(adminCommitteeController.createCommittee));
adminCommitteeRoutes.patch('/:id', asyncHandler(adminCommitteeController.updateCommittee));
adminCommitteeRoutes.patch(
  '/:id/status',
  asyncHandler(adminCommitteeController.toggleCommitteeStatus),
);
adminCommitteeRoutes.delete('/:id', asyncHandler(adminCommitteeController.deleteCommittee));

export default adminCommitteeRoutes;
