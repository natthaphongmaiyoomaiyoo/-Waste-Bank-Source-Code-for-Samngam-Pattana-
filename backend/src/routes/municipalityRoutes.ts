import { Router } from 'express';
import * as municipalityController from '../controllers/municipalityController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Municipality = the supervising organization. Everything here is read-only
// monitoring/reporting, except recording a late funeral payment (cash a member
// brings to clear what they still owe). Every route requires the 'municipality'
// role.
export const municipalityRoutes = Router();

municipalityRoutes.use(requireAuth, requireRole('municipality'));

// 1. Member monitoring
municipalityRoutes.get('/members', asyncHandler(municipalityController.listMembers));
municipalityRoutes.get('/members/summary', asyncHandler(municipalityController.getMembersSummary));
municipalityRoutes.get('/members/:id', asyncHandler(municipalityController.getMemberDetail));

// 2. Operation performance monitoring
municipalityRoutes.get('/operations/summary', asyncHandler(municipalityController.getOperationsSummary));
municipalityRoutes.get('/operations/sales', asyncHandler(municipalityController.listSales));

// 3. Fund monitoring
municipalityRoutes.get('/fund/summary', asyncHandler(municipalityController.getFundSummary));
municipalityRoutes.get('/fund/transactions', asyncHandler(municipalityController.listFundTransactions));

// 4. Reports
municipalityRoutes.get('/reports/monthly', asyncHandler(municipalityController.getMonthlyReport));
municipalityRoutes.get('/reports/yearly', asyncHandler(municipalityController.getYearlyReport));
municipalityRoutes.get('/reports/executive', asyncHandler(municipalityController.getExecutiveReport));
municipalityRoutes.get('/reports/villages', asyncHandler(municipalityController.getVillageSummaryReport));
municipalityRoutes.get('/reports/pdf-data', asyncHandler(municipalityController.getPdfReportData));

// 5. Deceased members (funeral cases)
municipalityRoutes.get('/funeral-cases', asyncHandler(municipalityController.listFuneralCases));
municipalityRoutes.get('/funeral-cases/:id', asyncHandler(municipalityController.getFuneralCaseDetail));
// Approving a committee's death report: marks the member deceased and charges
// the funeral contributions.
municipalityRoutes.post('/funeral-cases/:id/approve', asyncHandler(municipalityController.approveFuneralCase));
municipalityRoutes.post(
  '/funeral-cases/:id/contributions/:contributionId/payments',
  asyncHandler(municipalityController.recordFuneralPayment),
);
