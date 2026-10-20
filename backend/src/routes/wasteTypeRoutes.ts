import { Router } from 'express';
import * as wasteTypeController from '../controllers/wasteTypeController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const wasteTypeRoutes = Router();

wasteTypeRoutes.use(requireAuth);

// Shared catalog for admin maintenance, member sell requests, committee
// purchase forms, and the buyer's price list. Only 'active' types come back
// here. Direct mutations stay admin-only; buyers go through /proposals below.
wasteTypeRoutes.get(
  '/',
  requireRole('admin', 'committee', 'member', 'buyer'),
  asyncHandler(wasteTypeController.list),
);

// Buyer proposal flow. Declared before '/:id' so 'proposals' is never parsed as
// an id.
wasteTypeRoutes.get(
  '/proposals/mine',
  requireRole('buyer'),
  asyncHandler(wasteTypeController.listOwnProposals),
);
wasteTypeRoutes.post('/proposals', requireRole('buyer'), asyncHandler(wasteTypeController.propose));
wasteTypeRoutes.get(
  '/proposals',
  requireRole('admin'),
  asyncHandler(wasteTypeController.listProposals),
);
wasteTypeRoutes.post(
  '/proposals/:id/approve',
  requireRole('admin'),
  asyncHandler(wasteTypeController.approveProposal),
);
wasteTypeRoutes.post(
  '/proposals/:id/reject',
  requireRole('admin'),
  asyncHandler(wasteTypeController.rejectProposal),
);

wasteTypeRoutes.post('/', requireRole('admin'), asyncHandler(wasteTypeController.create));
wasteTypeRoutes.put('/:id', requireRole('admin'), asyncHandler(wasteTypeController.update));
wasteTypeRoutes.delete('/:id', requireRole('admin'), asyncHandler(wasteTypeController.remove));
