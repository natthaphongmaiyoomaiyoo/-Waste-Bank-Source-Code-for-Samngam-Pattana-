import { z } from 'zod';
import {
  FUNERAL_CASE_STATUS,
  MEMBER_FUND_FILTER,
  MEMBER_STATUS,
  FUND_TRANSACTION_TYPE,
} from '../config/constants.js';

// Municipality endpoints are mostly read-only GETs, so most schemas here
// validate query strings - hence z.coerce for numbers (query values arrive as
// strings). The writes (late funeral payments, approving a death report) take
// JSON bodies.

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

// "YYYY-MM-DD" (or full ISO) - anything new Date() can parse unambiguously.
const dateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

const yearSchema = z.coerce.number().int().min(2000).max(2100);
const monthSchema = z.coerce.number().int().min(1).max(12);

export const municipalityIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// POST /funeral-cases/:id/contributions/:contributionId/payments - cash a
// member brings later towards a funeral contribution they were short on.
export const funeralPaymentParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  contributionId: z.coerce.number().int().positive(),
});

export const funeralCaseApproveSchema = z.object({
  // The officer confirmed that the member misses the funeral conditions, so
  // nobody is charged and the heirs get only the member's own savings.
  ownSavingsOnly: z.boolean().optional(),
});

export const funeralPaymentBodySchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

export const memberListQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  // Matches name / citizen ID / phone / member code (contains).
  search: z.string().trim().min(1).optional(),
  status: z.enum(Object.values(MEMBER_STATUS) as [string, ...string[]]).optional(),
  // Not a member.status: selects members still under the 50-baht minimum.
  fundStatus: z.enum(Object.values(MEMBER_FUND_FILTER) as [string, ...string[]]).optional(),
  // Household filters (the address fields the schema actually has).
  moo: z.string().trim().min(1).optional(),
  subdistrict: z.string().trim().min(1).optional(),
});
export type MemberListQuery = z.infer<typeof memberListQuerySchema>;

// Shared operation filters: an explicit dateFrom/dateTo range, or a month/year
// (year alone = whole year), plus entity filters. dateFrom/dateTo win over
// month/year when both are sent - municipalityService.resolveDateRange decides.
const operationFiltersSchema = z
  .object({
    dateFrom: dateStringSchema.optional(),
    dateTo: dateStringSchema.optional(),
    month: monthSchema.optional(),
    year: yearSchema.optional(),
    memberId: z.coerce.number().int().positive().optional(),
    wasteTypeId: z.coerce.number().int().positive().optional(),
    roundId: z.coerce.number().int().positive().optional(),
    // Sale number, or the selling member's name / member code (contains).
    search: z.string().trim().min(1).optional(),
  })
  .refine((q) => !(q.month !== undefined && q.year === undefined), {
    message: 'month requires year',
    path: ['month'],
  })
  .refine((q) => !(q.dateFrom && q.dateTo && new Date(q.dateFrom) > new Date(q.dateTo)), {
    message: 'dateFrom must not be after dateTo',
    path: ['dateFrom'],
  });

export const operationsSummaryQuerySchema = operationFiltersSchema;
export type OperationsSummaryQuery = z.infer<typeof operationsSummaryQuerySchema>;

export const salesListQuerySchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .and(operationFiltersSchema);
export type SalesListQuery = z.infer<typeof salesListQuerySchema>;

export const fundTransactionsQuerySchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    transactionType: z
      .enum(Object.values(FUND_TRANSACTION_TYPE) as [string, ...string[]])
      .optional(),
    memberId: z.coerce.number().int().positive().optional(),
    // Transaction note, or the member's name / member code (contains).
    search: z.string().trim().min(1).optional(),
    dateFrom: dateStringSchema.optional(),
    dateTo: dateStringSchema.optional(),
  })
  .refine((q) => !(q.dateFrom && q.dateTo && new Date(q.dateFrom) > new Date(q.dateTo)), {
    message: 'dateFrom must not be after dateTo',
    path: ['dateFrom'],
  });
export type FundTransactionsQuery = z.infer<typeof fundTransactionsQuerySchema>;

export const monthlyReportQuerySchema = z.object({
  year: yearSchema,
  month: monthSchema,
});
export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;

export const yearlyReportQuerySchema = z.object({
  year: yearSchema,
});
export type YearlyReportQuery = z.infer<typeof yearlyReportQuerySchema>;

// PDF export report (เจ้าหน้าที่เทศบาล) - one endpoint returns every section the
// PDF builder needs; optional date range + village (household.moo) filter.
export const pdfReportQuerySchema = z
  .object({
    dateFrom: dateStringSchema.optional(),
    dateTo: dateStringSchema.optional(),
    moo: z.string().trim().min(1).optional(),
  })
  .refine((q) => !(q.dateFrom && q.dateTo && new Date(q.dateFrom) > new Date(q.dateTo)), {
    message: 'dateFrom must not be after dateTo',
    path: ['dateFrom'],
  });
export type PdfReportQuery = z.infer<typeof pdfReportQuerySchema>;

// Funeral (death) cases - the deceased-member report. Optional date range on
// the date of death, plus the same free-text search as the member list.
export const funeralCaseListQuerySchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    // Matches the deceased member's name / member code (contains).
    search: z.string().trim().min(1).optional(),
    dateFrom: dateStringSchema.optional(),
    dateTo: dateStringSchema.optional(),
    // The deceased member's village (household.village_area_id).
    villageAreaId: z.coerce.number().int().positive().optional(),
    // pending = committee reports waiting for approval; omitted = every case.
    status: z.enum(Object.values(FUNERAL_CASE_STATUS) as [string, ...string[]]).optional(),
  })
  .refine((q) => !(q.dateFrom && q.dateTo && new Date(q.dateFrom) > new Date(q.dateTo)), {
    message: 'dateFrom must not be after dateTo',
    path: ['dateFrom'],
  });
export type FuneralCaseListQuery = z.infer<typeof funeralCaseListQuerySchema>;
