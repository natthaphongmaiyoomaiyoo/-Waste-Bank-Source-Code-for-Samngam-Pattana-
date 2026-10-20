import { Router } from 'express';
import * as committeeController from '../controllers/committeeController.js';
import * as routePlanController from '../controllers/routePlanController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireVillageScope } from '../middleware/villageScope.js';
import {
  uploadDeathCertificate,
  uploadMemberDocument,
  uploadSaleDocument,
  uploadSaleDocuments,
} from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Waste Bank / Village Committee member management: register walk-in
// applicants, screen their eligibility (age / address / guarantor), then
// approve - plus edit / cancel / deceased and search.
// Committee role only (the requirement explicitly hides this from other roles).
//
// requireVillageScope pins every request below to the village the admin
// assigned to this committee account (admins stay unrestricted); the handlers
// then pass that scope down so cross-village access is refused server-side.
export const committeeRoutes = Router();

committeeRoutes.use(requireAuth, requireRole('committee', 'admin'), requireVillageScope);

// Overview dashboard: the committee's landing page reads everything below in
// one roll-up (fund totals, this month's stats, the current round's requests /
// area groups / route plans, what is waiting for approval, member statuses).
committeeRoutes.get('/dashboard', asyncHandler(committeeController.getDashboard));

// Household lookup lets the desk add multiple members under one household.
committeeRoutes.get('/households', asyncHandler(committeeController.listHouseholds));

// Member management (list route order matters: /summary before /:id).
committeeRoutes.get('/members', asyncHandler(committeeController.listMembers));
committeeRoutes.get('/members/summary', asyncHandler(committeeController.getMembersSummary));
committeeRoutes.get('/members/:id', asyncHandler(committeeController.getMemberDetail));
committeeRoutes.post('/members', asyncHandler(committeeController.createMember));
committeeRoutes.patch('/members/:id', asyncHandler(committeeController.updateMember));
// A member who forgot their password gets a new one from their committee.
committeeRoutes.patch('/members/:id/password', asyncHandler(committeeController.resetMemberPassword));
committeeRoutes.get('/members/:id/documents', asyncHandler(committeeController.listMemberDocuments));
committeeRoutes.post(
  '/members/:id/documents',
  uploadMemberDocument,
  asyncHandler(committeeController.addMemberDocument),
);
committeeRoutes.delete('/members/:id/documents/:documentId', asyncHandler(committeeController.deleteMemberDocument));

// Eligibility screening + lifecycle actions.
committeeRoutes.post('/members/:id/verification', asyncHandler(committeeController.recordVerification));
committeeRoutes.patch('/members/:id/approve', asyncHandler(committeeController.approveMember));
committeeRoutes.patch('/members/:id/cancel', asyncHandler(committeeController.cancelMember));
committeeRoutes.patch(
  '/members/:id/deceased',
  uploadDeathCertificate,
  asyncHandler(committeeController.markMemberDeceased),
);

// Member sell-requests: review, accept for pickup, record the actual purchase
// (route order matters: /summary before /:id).
committeeRoutes.get('/sell-requests', asyncHandler(committeeController.listSellRequests));
committeeRoutes.get('/sell-requests/summary', asyncHandler(committeeController.getSellRequestsSummary));
// Confirmed requests not yet on a live route plan, counted per round - what
// the route-plan round picker shows as "รอวางแผน".
committeeRoutes.get('/sell-requests/route-counts', asyncHandler(committeeController.getSellRequestRouteCounts));
committeeRoutes.get('/sell-requests/:id', asyncHandler(committeeController.getSellRequestDetail));
committeeRoutes.patch('/sell-requests/:id/confirm', asyncHandler(committeeController.confirmSellRequest));
committeeRoutes.patch('/sell-requests/:id/cancel', asyncHandler(committeeController.cancelSellRequest));
// multipart: the purchase JSON plus its mandatory proof files, in one request.
committeeRoutes.post(
  '/sell-requests/:id/purchase',
  uploadSaleDocuments,
  asyncHandler(committeeController.recordSellRequestPurchase),
);
// Proof of the purchase (photos / slips) - attached after the purchase is saved.
committeeRoutes.post(
  '/sell-requests/:id/documents',
  uploadSaleDocument,
  asyncHandler(committeeController.addSellRequestDocument),
);

// Waste-type catalog for the purchase form.
committeeRoutes.get('/waste-types', asyncHandler(committeeController.listWasteTypes));

// Collection rounds for the committee's own village (route order: /summary
// before /:id).
committeeRoutes.get('/rounds', asyncHandler(committeeController.listRounds));
committeeRoutes.get('/rounds/summary', asyncHandler(committeeController.getRoundsSummary));
committeeRoutes.get('/rounds/:id', asyncHandler(committeeController.getRound));
committeeRoutes.post('/rounds', asyncHandler(committeeController.createRound));
committeeRoutes.patch('/rounds/:id', asyncHandler(committeeController.updateRound));
committeeRoutes.patch('/rounds/:id/cancel', asyncHandler(committeeController.cancelRound));
committeeRoutes.patch('/rounds/:id/complete', asyncHandler(committeeController.completeRound));

// Pickup route plans: one per round per village, built as requests are accepted
// (route order: fixed paths before /:id). The committee only picks the start.
committeeRoutes.get('/route-plans', asyncHandler(routePlanController.listCommitteePlans));
committeeRoutes.get('/route-plans/:id', asyncHandler(routePlanController.getCommitteePlan));
committeeRoutes.patch('/route-plans/:id/start', asyncHandler(routePlanController.setStartPoint));

// Buyer options for the round form.
committeeRoutes.get('/buyers', asyncHandler(committeeController.listBuyers));
