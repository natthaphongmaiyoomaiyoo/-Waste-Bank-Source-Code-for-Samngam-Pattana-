import type { Request, Response } from 'express';
import * as municipalityService from '../services/municipalityService.js';
import { recordFuneralLatePayment } from '../services/funeralFundService.js';
import { approveFuneralCase as approveFuneralCaseService } from '../services/funeralCaseService.js';
import {
  fundTransactionsQuerySchema,
  funeralCaseApproveSchema,
  funeralCaseListQuerySchema,
  funeralPaymentBodySchema,
  funeralPaymentParamSchema,
  memberListQuerySchema,
  municipalityIdParamSchema,
  monthlyReportQuerySchema,
  operationsSummaryQuerySchema,
  pdfReportQuerySchema,
  salesListQuerySchema,
  yearlyReportQuerySchema,
} from '../validators/municipalityValidators.js';

export async function listMembers(req: Request, res: Response) {
  const query = memberListQuerySchema.parse(req.query);
  res.json(await municipalityService.listMembers(query));
}

export async function getMembersSummary(_req: Request, res: Response) {
  res.json(await municipalityService.getMembersSummary());
}

export async function getMemberDetail(req: Request, res: Response) {
  const { id } = municipalityIdParamSchema.parse(req.params);
  res.json(await municipalityService.getMemberDetail(id));
}

export async function getOperationsSummary(req: Request, res: Response) {
  const query = operationsSummaryQuerySchema.parse(req.query);
  res.json(await municipalityService.getOperationsSummary(query));
}

export async function listSales(req: Request, res: Response) {
  const query = salesListQuerySchema.parse(req.query);
  res.json(await municipalityService.listSales(query));
}

export async function getFundSummary(_req: Request, res: Response) {
  res.json(await municipalityService.getFundSummary());
}

export async function listFundTransactions(req: Request, res: Response) {
  const query = fundTransactionsQuerySchema.parse(req.query);
  res.json(await municipalityService.listFundTransactions(query));
}

export async function getMonthlyReport(req: Request, res: Response) {
  const query = monthlyReportQuerySchema.parse(req.query);
  res.json(await municipalityService.getMonthlyReport(query));
}

export async function getYearlyReport(req: Request, res: Response) {
  const query = yearlyReportQuerySchema.parse(req.query);
  res.json(await municipalityService.getYearlyReport(query));
}

export async function getExecutiveReport(_req: Request, res: Response) {
  res.json(await municipalityService.getExecutiveReport());
}

export async function getVillageSummaryReport(_req: Request, res: Response) {
  res.json(await municipalityService.getVillageSummaryReport());
}

export async function getPdfReportData(req: Request, res: Response) {
  const query = pdfReportQuerySchema.parse(req.query);
  res.json(await municipalityService.getPdfReportData(query));
}

// 5. Deceased members (funeral cases): who died, who was charged the welfare
// contribution, and what the family receives.
export async function listFuneralCases(req: Request, res: Response) {
  const query = funeralCaseListQuerySchema.parse(req.query);
  res.json(await municipalityService.listFuneralCases(query));
}

export async function getFuneralCaseDetail(req: Request, res: Response) {
  const { id } = municipalityIdParamSchema.parse(req.params);
  res.json(await municipalityService.getFuneralCaseDetail(id));
}

export async function approveFuneralCase(req: Request, res: Response) {
  const { id } = municipalityIdParamSchema.parse(req.params);
  const input = funeralCaseApproveSchema.parse(req.body ?? {});
  res.json(await approveFuneralCaseService(id, input, req.auth!.userId));
}

// Cash a member brings later towards a funeral contribution they were short on.
export async function recordFuneralPayment(req: Request, res: Response) {
  const { id, contributionId } = funeralPaymentParamSchema.parse(req.params);
  const { amount, note } = funeralPaymentBodySchema.parse(req.body);
  res.status(201).json(
    await recordFuneralLatePayment({
      funeralCaseId: id,
      contributionId,
      amount,
      note,
      recordedBy: req.auth!.userId,
    }),
  );
}
