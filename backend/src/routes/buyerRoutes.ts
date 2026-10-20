import { Router } from 'express';
import * as routePlanController from '../controllers/routePlanController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireBuyerScope } from '../middleware/buyerScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// The buyer's side of the pickup run: read the route plans the village
// committee confirmed and hand-marked to this shop, then mark each stop while
// driving it.
//
// requireBuyerScope pins every request below to the shop the admin bound to
// this account (admins stay unrestricted), so another shop's plan is refused
// server-side even though the UI never offers it - same shape as
// requireVillageScope on committeeRoutes.
export const buyerRoutes = Router();

buyerRoutes.use(requireAuth, requireRole('buyer', 'admin'), requireBuyerScope);

buyerRoutes.get('/route-plans', asyncHandler(routePlanController.listBuyerPlans));
buyerRoutes.get('/route-plans/:id', asyncHandler(routePlanController.getBuyerPlan));
buyerRoutes.patch(
  '/route-plans/:id/stops/:stopId',
  asyncHandler(routePlanController.markStop),
);
