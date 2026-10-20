import { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { evaluateMembersEligibility } from "./eligibilityService.js";
import { belowMinimumContributionWhere } from "./fundService.js";
import { memberSearchWhere } from "./memberService.js";
import { privateFileUrl, publicFileUrl } from "./storageService.js";
import { previewFuneralApproval } from "./funeralCaseService.js";
import {
  CO2_CREDIT_DEFAULT_FACTOR_KG_CO2E_PER_KG,
  CO2_CREDIT_WASTE_TYPE_FACTORS,
  FUND_MINIMUM_BAHT,
  FUND_TRANSACTION_TYPE,
  FUNERAL_CASE_STATUS,
  FUNERAL_CONTRIBUTION_STATUS,
  MEMBER_FUND_FILTER,
  MEMBER_STATUS,
} from "../config/constants.js";
import type {
  FundTransactionsQuery,
  FuneralCaseListQuery,
  MemberListQuery,
  MonthlyReportQuery,
  OperationsSummaryQuery,
  PdfReportQuery,
  SalesListQuery,
  YearlyReportQuery,
} from "../validators/municipalityValidators.js";

// Read-only monitoring/reporting service for the Municipality role - the
// supervising organization. Nothing in this file writes to the database.
//
// Welfare/funeral payouts: the ERD's funeral_claim / funeral_payment tables are
// not implemented in this pass (see backend/README.md "Assumptions"), so payout
// monitoring is exposed through fund_transaction rows with
// transaction_type = 'benefit_payment'. When the funeral tables are added later,
// a /municipality/welfare/* route group can be added here without touching or
// breaking any of the existing endpoints below.

// ---------------------------------------------------------------------------
// Date-range helpers
// ---------------------------------------------------------------------------

interface DateRange {
  from: Date;
  to: Date; // exclusive
}

// "YYYY-MM-DD" is treated as a *local* calendar date (the server runs in the
// community's timezone); anything else falls back to normal Date parsing.
function parseDateParam(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Explicit dateFrom/dateTo win over month/year; month requires year (validated);
// year alone means the whole year; nothing set means all-time (undefined).
function resolveDateRange(query: {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  month?: number | undefined;
  year?: number | undefined;
}): DateRange | undefined {
  if (query.dateFrom || query.dateTo) {
    const from = query.dateFrom ? parseDateParam(query.dateFrom) : new Date(0);
    const to = query.dateTo
      ? addDays(parseDateParam(query.dateTo), 1)
      : addDays(new Date(), 1);
    return { from, to };
  }
  if (query.year !== undefined && query.month !== undefined) {
    return {
      from: new Date(query.year, query.month - 1, 1),
      to: new Date(query.year, query.month, 1),
    };
  }
  if (query.year !== undefined) {
    return {
      from: new Date(query.year, 0, 1),
      to: new Date(query.year + 1, 0, 1),
    };
  }
  return undefined;
}

function saleDateFilter(range: DateRange | undefined) {
  return range ? { saleDate: { gte: range.from, lt: range.to } } : {};
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "bigint" ? Number(value) : Number(value);
}

interface SaleSqlFilters {
  memberId?: number | undefined;
  roundId?: number | undefined;
  search?: string | undefined;
}

// Free-text sale search shared by every operations query (raw SQL here, and
// buildSaleWhere's Prisma twin below): sale number, or the selling member's
// name / member code. `alias` is the waste_sale alias of the query it goes into.
function saleSearchSql(alias: string, search: string) {
  const like = `%${search}%`;
  const ws = Prisma.raw(alias);
  return Prisma.sql`(${ws}.sale_no LIKE ${like} OR ${ws}.member_id IN (
    SELECT m.member_id FROM member m
    WHERE m.first_name LIKE ${like} OR m.last_name LIKE ${like} OR m.member_code LIKE ${like}
  ))`;
}

function saleSqlWhere(
  range: DateRange | undefined,
  filters: SaleSqlFilters = {},
) {
  const conditions: Prisma.Sql[] = [Prisma.sql`ws.status = 'completed'`];

  if (range) {
    conditions.push(Prisma.sql`ws.sale_date >= ${range.from}`);
    conditions.push(Prisma.sql`ws.sale_date < ${range.to}`);
  }
  if (filters.memberId) {
    conditions.push(Prisma.sql`ws.member_id = ${filters.memberId}`);
  }
  if (filters.roundId) {
    conditions.push(Prisma.sql`ws.round_id = ${filters.roundId}`);
  }
  if (filters.search) {
    conditions.push(saleSearchSql("ws", filters.search));
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

interface OperationTotals {
  completedSaleCount: number;
  totalAmount: number;
  totalFundDeduct: number;
  totalNetPaid: number;
  totalQuantity: number;
  memberParticipatedCount: number;
}

interface WasteTypeBreakdown {
  wasteTypeId: number;
  wasteName: string;
  unit: string;
  quantity: number;
  amount: number;
}

interface Co2CreditBreakdown extends WasteTypeBreakdown {
  emissionReductionFactor: number;
  estimatedKgCo2e: number;
  estimatedTCo2e: number;
}

interface Co2CreditSummary {
  totalWasteSold: number;
  estimatedKgCo2e: number;
  estimatedTCo2e: number;
  defaultEmissionReductionFactor: number;
  byWasteType: Co2CreditBreakdown[];
  // Waste types whose unit is not kilograms - their quantity cannot be
  // multiplied by a kgCO2e/kg factor, so they are listed here instead of
  // silently skewing the estimate.
  excludedWasteTypes: WasteTypeBreakdown[];
}

interface MonthlyPoint {
  month: string;
  saleCount: number;
  totalAmount: number;
  fundDeductAmount: number;
  netAmount: number;
  quantity: number;
}

interface RawOperationTotals {
  completedSaleCount: unknown;
  totalAmount: unknown;
  totalFundDeduct: unknown;
  totalNetPaid: unknown;
  totalQuantity: unknown;
  memberParticipatedCount: unknown;
}

function normalizeOperationTotals(
  row: RawOperationTotals | undefined,
): OperationTotals {
  return {
    completedSaleCount: toNumber(row?.completedSaleCount),
    totalAmount: toNumber(row?.totalAmount),
    totalFundDeduct: toNumber(row?.totalFundDeduct),
    totalNetPaid: toNumber(row?.totalNetPaid),
    totalQuantity: toNumber(row?.totalQuantity),
    memberParticipatedCount: toNumber(row?.memberParticipatedCount),
  };
}

function normalizeFactorKey(value: string): string {
  return value.trim().toLowerCase();
}

function getEmissionReductionFactor(
  row: Pick<WasteTypeBreakdown, "wasteTypeId" | "wasteName">,
): number {
  return (
    CO2_CREDIT_WASTE_TYPE_FACTORS[String(row.wasteTypeId)] ??
    CO2_CREDIT_WASTE_TYPE_FACTORS[normalizeFactorKey(row.wasteName)] ??
    CO2_CREDIT_DEFAULT_FACTOR_KG_CO2E_PER_KG
  );
}

// The emission factors are kgCO2e per *kilogram*, but waste_type.unit is free
// text ("kg", "piece", ...). Only kg-unit rows enter the estimate; other units
// are reported separately so the number never mixes incompatible quantities.
const KG_UNIT_ALIASES = new Set([
  "kg",
  "kg.",
  "kgs",
  "kilogram",
  "kilograms",
  "กก",
  "กก.",
  "กิโลกรัม",
  "กิโล",
]);

function isKilogramUnit(unit: string): boolean {
  return KG_UNIT_ALIASES.has(unit.trim().toLowerCase());
}

function buildCo2CreditSummary(
  byWasteType: WasteTypeBreakdown[],
): Co2CreditSummary {
  const kgRows = byWasteType.filter((row) => isKilogramUnit(row.unit));
  const excludedWasteTypes = byWasteType.filter(
    (row) => !isKilogramUnit(row.unit),
  );

  const breakdown = kgRows.map((row) => {
    const factor = getEmissionReductionFactor(row);
    const estimatedKgCo2e = row.quantity * factor;
    return {
      ...row,
      emissionReductionFactor: factor,
      estimatedKgCo2e,
      estimatedTCo2e: estimatedKgCo2e / 1000,
    };
  });
  const estimatedKgCo2e = breakdown.reduce(
    (sum, row) => sum + row.estimatedKgCo2e,
    0,
  );

  return {
    totalWasteSold: kgRows.reduce((sum, row) => sum + row.quantity, 0),
    estimatedKgCo2e,
    estimatedTCo2e: estimatedKgCo2e / 1000,
    defaultEmissionReductionFactor: CO2_CREDIT_DEFAULT_FACTOR_KG_CO2E_PER_KG,
    byWasteType: breakdown.sort(
      (a, b) => b.estimatedKgCo2e - a.estimatedKgCo2e,
    ),
    excludedWasteTypes,
  };
}

async function aggregateOperationTotals(
  query: OperationsSummaryQuery,
): Promise<OperationTotals> {
  const range = resolveDateRange(query);
  const where = saleSqlWhere(range, {
    memberId: query.memberId,
    roundId: query.roundId,
    search: query.search,
  });

  if (query.wasteTypeId) {
    const rows = await prisma.$queryRaw<RawOperationTotals[]>`
      SELECT
        COUNT(DISTINCT ws.sale_id) AS "completedSaleCount",
        COALESCE(SUM(wsd.subtotal), 0) AS "totalAmount",
        COALESCE(SUM(CASE WHEN ws.total_amount > 0 THEN ws.fund_deduct_amount * (wsd.subtotal / ws.total_amount) ELSE 0 END), 0) AS "totalFundDeduct",
        COALESCE(SUM(CASE WHEN ws.total_amount > 0 THEN ws.net_amount * (wsd.subtotal / ws.total_amount) ELSE 0 END), 0) AS "totalNetPaid",
        COALESCE(SUM(wsd.quantity), 0) AS "totalQuantity",
        COUNT(DISTINCT ws.member_id) AS "memberParticipatedCount"
      FROM waste_sale_detail wsd
      JOIN waste_sale ws ON ws.sale_id = wsd.sale_id
      ${where}
        AND wsd.waste_type_id = ${query.wasteTypeId}
    `;
    return normalizeOperationTotals(rows[0]);
  }

  const rows = await prisma.$queryRaw<RawOperationTotals[]>`
    SELECT
      COUNT(*) AS "completedSaleCount",
      COALESCE(SUM(ws.total_amount), 0) AS "totalAmount",
      COALESCE(SUM(ws.fund_deduct_amount), 0) AS "totalFundDeduct",
      COALESCE(SUM(ws.net_amount), 0) AS "totalNetPaid",
      COALESCE((
        SELECT SUM(wsd.quantity)
        FROM waste_sale_detail wsd
        JOIN waste_sale qws ON qws.sale_id = wsd.sale_id
        WHERE qws.status = 'completed'
          ${range ? Prisma.sql`AND qws.sale_date >= ${range.from} AND qws.sale_date < ${range.to}` : Prisma.empty}
          ${query.memberId ? Prisma.sql`AND qws.member_id = ${query.memberId}` : Prisma.empty}
          ${query.roundId ? Prisma.sql`AND qws.round_id = ${query.roundId}` : Prisma.empty}
          ${query.search ? Prisma.sql`AND ${saleSearchSql("qws", query.search)}` : Prisma.empty}
      ), 0) AS "totalQuantity",
      COUNT(DISTINCT ws.member_id) AS "memberParticipatedCount"
    FROM waste_sale ws
    ${where}
  `;
  return normalizeOperationTotals(rows[0]);
}

async function aggregateOperationTotalsForRange(
  range: DateRange,
): Promise<OperationTotals> {
  const where = saleSqlWhere(range);
  const rows = await prisma.$queryRaw<RawOperationTotals[]>`
    SELECT
      COUNT(*) AS "completedSaleCount",
      COALESCE(SUM(ws.total_amount), 0) AS "totalAmount",
      COALESCE(SUM(ws.fund_deduct_amount), 0) AS "totalFundDeduct",
      COALESCE(SUM(ws.net_amount), 0) AS "totalNetPaid",
      COALESCE((
        SELECT SUM(wsd.quantity)
        FROM waste_sale_detail wsd
        JOIN waste_sale qws ON qws.sale_id = wsd.sale_id
        WHERE qws.status = 'completed'
          AND qws.sale_date >= ${range.from}
          AND qws.sale_date < ${range.to}
      ), 0) AS "totalQuantity",
      COUNT(DISTINCT ws.member_id) AS "memberParticipatedCount"
    FROM waste_sale ws
    ${where}
  `;
  return normalizeOperationTotals(rows[0]);
}

interface RawMonthlySales {
  month: string | null;
  saleCount: unknown;
  totalAmount: unknown;
  fundDeductAmount: unknown;
  netAmount: unknown;
}

interface RawMonthlyQuantity {
  month: string | null;
  quantity: unknown;
}

interface RawMonthlyFiltered extends RawMonthlySales {
  quantity: unknown;
}

async function getMonthlySeries(
  query: OperationsSummaryQuery,
): Promise<MonthlyPoint[]> {
  const range = resolveDateRange(query);
  const where = saleSqlWhere(range, {
    memberId: query.memberId,
    roundId: query.roundId,
    search: query.search,
  });

  if (query.wasteTypeId) {
    const rows = await prisma.$queryRaw<RawMonthlyFiltered[]>`
      SELECT
        to_char(ws.sale_date, 'YYYY-MM') AS month,
        COUNT(DISTINCT ws.sale_id) AS "saleCount",
        COALESCE(SUM(wsd.subtotal), 0) AS "totalAmount",
        COALESCE(SUM(CASE WHEN ws.total_amount > 0 THEN ws.fund_deduct_amount * (wsd.subtotal / ws.total_amount) ELSE 0 END), 0) AS "fundDeductAmount",
        COALESCE(SUM(CASE WHEN ws.total_amount > 0 THEN ws.net_amount * (wsd.subtotal / ws.total_amount) ELSE 0 END), 0) AS "netAmount",
        COALESCE(SUM(wsd.quantity), 0) AS quantity
      FROM waste_sale_detail wsd
      JOIN waste_sale ws ON ws.sale_id = wsd.sale_id
      ${where}
        AND wsd.waste_type_id = ${query.wasteTypeId}
      GROUP BY month
      ORDER BY month ASC
    `;

    return rows
      .filter((row) => row.month)
      .map((row) => ({
        month: row.month!,
        saleCount: toNumber(row.saleCount),
        totalAmount: toNumber(row.totalAmount),
        fundDeductAmount: toNumber(row.fundDeductAmount),
        netAmount: toNumber(row.netAmount),
        quantity: toNumber(row.quantity),
      }));
  }

  const [salesRows, quantityRows] = await Promise.all([
    prisma.$queryRaw<RawMonthlySales[]>`
      SELECT
        to_char(ws.sale_date, 'YYYY-MM') AS month,
        COUNT(*) AS "saleCount",
        COALESCE(SUM(ws.total_amount), 0) AS "totalAmount",
        COALESCE(SUM(ws.fund_deduct_amount), 0) AS "fundDeductAmount",
        COALESCE(SUM(ws.net_amount), 0) AS "netAmount"
      FROM waste_sale ws
      ${where}
      GROUP BY month
      ORDER BY month ASC
    `,
    prisma.$queryRaw<RawMonthlyQuantity[]>`
      SELECT
        to_char(ws.sale_date, 'YYYY-MM') AS month,
        COALESCE(SUM(wsd.quantity), 0) AS quantity
      FROM waste_sale_detail wsd
      JOIN waste_sale ws ON ws.sale_id = wsd.sale_id
      ${where}
      GROUP BY month
      ORDER BY month ASC
    `,
  ]);

  const quantityByMonth = new Map(
    quantityRows
      .filter((row) => row.month)
      .map((row) => [row.month!, toNumber(row.quantity)]),
  );

  return salesRows
    .filter((row) => row.month)
    .map((row) => ({
      month: row.month!,
      saleCount: toNumber(row.saleCount),
      totalAmount: toNumber(row.totalAmount),
      fundDeductAmount: toNumber(row.fundDeductAmount),
      netAmount: toNumber(row.netAmount),
      quantity: quantityByMonth.get(row.month!) ?? 0,
    }));
}

interface RawMonthlyWasteType {
  month: string | null;
  wasteTypeId: unknown;
  wasteName: string;
  unit: string;
  quantity: unknown;
}

interface Co2MonthlySlice {
  wasteTypeId: number;
  wasteName: string;
  quantity: number;
  estimatedKgCo2e: number;
}

interface Co2MonthlyPoint {
  month: string;
  estimatedKgCo2e: number;
  byWasteType: Co2MonthlySlice[];
}

// Per-month CO2 composition. The flat monthly series only carries totals, but
// the dashboard stacks each bucket by waste type, so the split has to come off
// the detail rows. Same kg-unit rule as buildCo2CreditSummary: a type priced in
// anything but kilograms cannot be multiplied by a kgCO2e/kg factor.
async function getMonthlyCo2Series(
  range: DateRange,
): Promise<Co2MonthlyPoint[]> {
  const where = saleSqlWhere(range);
  const rows = await prisma.$queryRaw<RawMonthlyWasteType[]>`
    SELECT
      to_char(ws.sale_date, 'YYYY-MM') AS month,
      wsd.waste_type_id AS "wasteTypeId",
      wt.waste_name AS "wasteName",
      wt.unit AS unit,
      COALESCE(SUM(wsd.quantity), 0) AS quantity
    FROM waste_sale_detail wsd
    JOIN waste_sale ws ON ws.sale_id = wsd.sale_id
    JOIN waste_type wt ON wt.waste_type_id = wsd.waste_type_id
    ${where}
    GROUP BY month, wsd.waste_type_id, wt.waste_name, wt.unit
    ORDER BY month ASC
  `;

  const byMonth = new Map<string, Co2MonthlyPoint>();
  for (const row of rows) {
    if (!row.month || !isKilogramUnit(row.unit)) continue;

    const wasteTypeId = toNumber(row.wasteTypeId);
    const quantity = toNumber(row.quantity);
    const estimatedKgCo2e =
      quantity *
      getEmissionReductionFactor({ wasteTypeId, wasteName: row.wasteName });

    const point = byMonth.get(row.month) ?? {
      month: row.month,
      estimatedKgCo2e: 0,
      byWasteType: [],
    };
    point.estimatedKgCo2e += estimatedKgCo2e;
    point.byWasteType.push({
      wasteTypeId,
      wasteName: row.wasteName,
      quantity,
      estimatedKgCo2e,
    });
    byMonth.set(row.month, point);
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

interface RawMonthlyFund {
  month: string | null;
  amountIn: unknown;
  amountOut: unknown;
}

async function getMonthlyFundSeries(range: DateRange) {
  const rows = await prisma.$queryRaw<RawMonthlyFund[]>`
    SELECT
      to_char(transaction_date, 'YYYY-MM') AS month,
      COALESCE(SUM(amount_in), 0) AS "amountIn",
      COALESCE(SUM(amount_out), 0) AS "amountOut"
    FROM fund_transaction
    WHERE transaction_date >= ${range.from}
      AND transaction_date < ${range.to}
    GROUP BY month
  `;

  return new Map(
    rows
      .filter((row) => row.month)
      .map((row) => [
        row.month!,
        {
          amountIn: toNumber(row.amountIn),
          amountOut: toNumber(row.amountOut),
        },
      ]),
  );
}

// ---------------------------------------------------------------------------
// 1. Member monitoring
// ---------------------------------------------------------------------------

export async function listMembers(query: MemberListQuery) {
  const { page, pageSize } = query;

  const where: Prisma.MemberWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? memberSearchWhere(query.search) : {}),
    ...(query.moo || query.subdistrict
      ? {
          household: {
            ...(query.moo ? { moo: query.moo } : {}),
            ...(query.subdistrict
              ? { subdistrict: { contains: query.subdistrict } }
              : {}),
          },
        }
      : {}),
    // AND (not a spread) so the fund filter cannot clobber the search OR above.
    ...(query.fundStatus === MEMBER_FUND_FILTER.BELOW_MINIMUM
      ? { AND: [belowMinimumContributionWhere] }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      include: {
        household: true,
        fundBalance: true,
        userAccount: { select: { status: true, lastLogin: true, avatarUrl: true } },
      },
      orderBy: { memberCode: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    // Same shape as committeeService.listMembers: the absolute avatar URL rides
    // at the top level so the list can show profile photos.
    items: items.map((member) => ({
      ...member,
      avatarUrl: publicFileUrl("avatars", member.userAccount?.avatarUrl ?? null),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getMembersSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, byStatusRaw, newThisMonth, householdCount, mooRows] =
    await Promise.all([
      prisma.member.count(),
      prisma.member.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.member.count({ where: { applyDate: { gte: monthStart } } }),
      prisma.household.count(),
      // Options for the member list's "หมู่ที่" dropdown. Read off the households
      // members actually live in, not village_area master data: the list filter
      // matches household.moo, and a moo with members but no village_area row
      // would otherwise be impossible to pick.
      prisma.household.findMany({
        where: { moo: { not: null }, members: { some: {} } },
        select: { moo: true },
        distinct: ["moo"],
      }),
    ]);

  const byStatus = Object.fromEntries(
    byStatusRaw.map((row) => [row.status, row._count._all]),
  );
  const moos = mooRows
    .map((row) => row.moo?.trim() ?? "")
    .filter((moo) => moo !== "")
    .sort((a, b) => a.localeCompare(b, "th", { numeric: true }));

  return {
    total,
    byStatus,
    newThisMonth,
    householdCount,
    moos: [...new Set(moos)],
  };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getMemberDetail(memberId: number) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      household: true,
      guarantors: true,
      fundBalance: true,
      userAccount: {
        select: { username: true, status: true, lastLogin: true, avatarUrl: true },
      },
    },
  });
  if (!member) {
    throw ApiError.notFound("Member not found");
  }

  const [
    salesAgg,
    quantityAgg,
    recentSales,
    fundTransactions,
    latestEligibility,
    saleDates,
    eligibility,
  ] = await Promise.all([
    prisma.wasteSale.aggregate({
      where: { memberId, status: "completed" },
      _count: { _all: true },
      _sum: { totalAmount: true, fundDeductAmount: true, netAmount: true },
    }),
    prisma.wasteSaleDetail.aggregate({
      where: { sale: { memberId, status: "completed" } },
      _sum: { quantity: true },
    }),
    prisma.wasteSale.findMany({
      where: { memberId },
      include: { details: { include: { wasteType: true } }, round: true },
      orderBy: { saleDate: "desc" },
      take: 10,
    }),
    prisma.fundTransaction.findMany({
      where: { memberId },
      orderBy: { transactionDate: "desc" },
      take: 10,
    }),
    prisma.eligibilityCheck.findFirst({
      where: { memberId },
      orderBy: { checkDate: "desc" },
    }),
    prisma.wasteSale.findMany({
      where: { memberId, status: "completed" },
      select: { saleDate: true },
    }),
    // Each welfare condition evaluated against today's data, for the page's
    // pass/fail checklist. Read-only: unlike checkMemberEligibility it writes no
    // eligibility_check row, so opening the page leaves no trace.
    evaluateMembersEligibility([member]),
  ]);

  const activeMonthCount = new Set(saleDates.map((s) => monthKey(s.saleDate)))
    .size;

  return {
    // Same shape as committeeService.listMembers: the absolute avatar URL rides
    // at the top level, the raw stored path stays where Prisma put it.
    member: {
      ...member,
      avatarUrl: publicFileUrl("avatars", member.userAccount?.avatarUrl ?? null),
    },
    participation: {
      completedSaleCount: salesAgg._count._all,
      totalAmount: salesAgg._sum.totalAmount ?? 0,
      totalFundDeduct: salesAgg._sum.fundDeductAmount ?? 0,
      totalNetIncome: salesAgg._sum.netAmount ?? 0,
      totalQuantity: quantityAgg._sum.quantity ?? 0,
      activeMonthCount,
    },
    recentSales,
    fundTransactions,
    latestEligibility,
    eligibility: eligibility.get(member.id) ?? null,
  };
}

// ---------------------------------------------------------------------------
// 2. Operation performance monitoring
// ---------------------------------------------------------------------------

// Prisma twin of saleSqlWhere - keep the search rule in step with saleSearchSql.
function buildSaleWhere(
  query: OperationsSummaryQuery,
): Prisma.WasteSaleWhereInput {
  return {
    status: "completed",
    ...saleDateFilter(resolveDateRange(query)),
    ...(query.memberId ? { memberId: query.memberId } : {}),
    ...(query.roundId ? { roundId: query.roundId } : {}),
    ...(query.wasteTypeId
      ? { details: { some: { wasteTypeId: query.wasteTypeId } } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { saleNo: { contains: query.search } },
            { receipt: { receiptNo: { contains: query.search } } },
            {
              member: {
                OR: [
                  { firstName: { contains: query.search } },
                  { lastName: { contains: query.search } },
                  { memberCode: { contains: query.search } },
                ],
              },
            },
          ],
        }
      : {}),
  };
}

export async function getOperationsSummary(query: OperationsSummaryQuery) {
  const saleWhere = buildSaleWhere(query);
  // Note: when wasteTypeId is set, quantity/byWasteType count only that type's
  // line items, while the amount totals stay sale-level (a sale that includes
  // the type counts in full) - the sale is the unit money moves in.
  const detailWhere = {
    sale: saleWhere,
    ...(query.wasteTypeId ? { wasteTypeId: query.wasteTypeId } : {}),
  };

  const [totals, byWasteTypeRaw, recentSales, monthlySeries, matchingSaleIds] =
    await Promise.all([
      aggregateOperationTotals(query),
      prisma.wasteSaleDetail.groupBy({
        by: ["wasteTypeId"],
        where: detailWhere,
        _sum: { quantity: true, subtotal: true },
      }),
      prisma.wasteSale.findMany({
        where: saleWhere,
        include: {
          member: {
            select: {
              memberCode: true,
              prefix: true,
              firstName: true,
              lastName: true,
            },
          },
          details: { include: { wasteType: true } },
        },
        orderBy: { saleDate: "desc" },
        take: 5,
      }),
      getMonthlySeries(query),
      prisma.wasteSale.findMany({ where: saleWhere, select: { id: true } }),
    ]);

  // Surplus the members chose to leave in the fund instead of taking as cash -
  // deposit transactions are linked to their sale, so the same filters apply.
  const depositAgg = await prisma.fundTransaction.aggregate({
    where: {
      transactionType: FUND_TRANSACTION_TYPE.DEPOSIT,
      saleId: { in: matchingSaleIds.map((sale) => sale.id) },
    },
    _sum: { amountIn: true },
  });
  const totalMemberDeposit = depositAgg._sum.amountIn ?? 0;

  const wasteTypes = await prisma.wasteType.findMany({
    where: { id: { in: byWasteTypeRaw.map((row) => row.wasteTypeId) } },
  });
  const wasteTypeById = new Map(wasteTypes.map((wt) => [wt.id, wt]));

  const byWasteType = byWasteTypeRaw
    .map((row) => ({
      wasteTypeId: row.wasteTypeId,
      wasteName:
        wasteTypeById.get(row.wasteTypeId)?.wasteName ?? `#${row.wasteTypeId}`,
      unit: wasteTypeById.get(row.wasteTypeId)?.unit ?? "kg",
      quantity: row._sum.quantity ?? 0,
      amount: row._sum.subtotal ?? 0,
    }))
    .sort((a, b) => b.quantity - a.quantity);

  return {
    completedSaleCount: totals.completedSaleCount,
    totalAmount: totals.totalAmount,
    totalFundDeduct: totals.totalFundDeduct,
    totalNetPaid: totals.totalNetPaid,
    totalMemberDeposit,
    totalQuantity: totals.totalQuantity,
    memberParticipatedCount: totals.memberParticipatedCount,
    byWasteType,
    monthlySeries,
    recentSales,
  };
}

export async function listSales(query: SalesListQuery) {
  const { page, pageSize } = query;
  const where = buildSaleWhere(query);

  const [total, items] = await Promise.all([
    prisma.wasteSale.count({ where }),
    prisma.wasteSale.findMany({
      where,
      include: {
        member: {
          select: {
            memberCode: true,
            prefix: true,
            firstName: true,
            lastName: true,
          },
        },
        details: { include: { wasteType: true } },
        round: { select: { id: true, roundDate: true, locationNote: true } },
        // The receipt number is what the member holds, so the list shows it.
        receipt: { select: { receiptNo: true } },
      },
      orderBy: { saleDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

interface SeriesSale {
  saleDate: Date;
  totalAmount: number;
  fundDeductAmount: number;
  netAmount: number;
  details: { quantity: number }[];
}

// Month-by-month roll-up done in JS - community-scale data (a few sales per
// member per month), not worth raw SQL.
function buildMonthlySeries(sales: SeriesSale[]) {
  const byMonth = new Map<
    string,
    {
      month: string;
      saleCount: number;
      totalAmount: number;
      fundDeductAmount: number;
      netAmount: number;
      quantity: number;
    }
  >();

  for (const sale of sales) {
    const key = monthKey(sale.saleDate);
    const entry = byMonth.get(key) ?? {
      month: key,
      saleCount: 0,
      totalAmount: 0,
      fundDeductAmount: 0,
      netAmount: 0,
      quantity: 0,
    };
    entry.saleCount += 1;
    entry.totalAmount += sale.totalAmount;
    entry.fundDeductAmount += sale.fundDeductAmount;
    entry.netAmount += sale.netAmount;
    entry.quantity += sale.details.reduce((sum, d) => sum + d.quantity, 0);
    byMonth.set(key, entry);
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// ---------------------------------------------------------------------------
// 3. Fund monitoring
// ---------------------------------------------------------------------------

export async function getFundSummary() {
  const [
    accounts,
    totalsAgg,
    memberBalancesAgg,
    activeMemberCount,
    belowMinimumCount,
    byTypeRaw,
    recentTransactions,
  ] = await Promise.all([
    prisma.fundAccount.findMany({ orderBy: { id: "asc" } }),
    prisma.fundTransaction.aggregate({
      _sum: { amountIn: true, amountOut: true },
    }),
    prisma.memberFundBalance.aggregate({
      _sum: { totalContribution: true },
    }),
    prisma.member.count({ where: { status: MEMBER_STATUS.ACTIVE } }),
    prisma.member.count({
      where: { AND: [{ status: MEMBER_STATUS.ACTIVE }, belowMinimumContributionWhere] },
    }),
    prisma.fundTransaction.groupBy({
      by: ["transactionType"],
      _count: { _all: true },
      _sum: { amountIn: true, amountOut: true },
    }),
    prisma.fundTransaction.findMany({
      include: {
        member: {
          select: {
            memberCode: true,
            prefix: true,
            firstName: true,
            lastName: true,
          },
        },
        fundAccount: { select: { accountName: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 10,
    }),
  ]);

  const byType = Object.fromEntries(
    byTypeRaw.map((row) => [
      row.transactionType,
      {
        count: row._count._all,
        amountIn: row._sum.amountIn ?? 0,
        amountOut: row._sum.amountOut ?? 0,
      },
    ]),
  );

  return {
    accounts,
    totalBalance: accounts.reduce((sum, a) => sum + a.balance, 0),
    totalIn: totalsAgg._sum.amountIn ?? 0,
    totalOut: totalsAgg._sum.amountOut ?? 0,
    // Every member's savings balance added up, summed from member_fund_balance
    // instead of replayed from the ledger: money flows in through two
    // transaction types (contribution, deposit) and out through
    // benefit_payment, so an in-minus-out formula over one type undercounts it
    // and can even land below zero.
    contributionBalance: memberBalancesAgg._sum.totalContribution ?? 0,
    // Echoed so dashboards can size the "every member holds this much" target
    // without hardcoding the rule on the client.
    minimumPerMember: FUND_MINIMUM_BAHT,
    // Savings have no ceiling, so "how covered is the minimum" is a head count
    // (active members at or above it), not total savings over members x minimum.
    activeMemberCount,
    belowMinimumCount,
    byType,
    // Welfare/funeral support payouts recorded so far (see the header comment
    // about the not-yet-implemented funeral_claim / funeral_payment tables).
    welfarePayments: byType[FUND_TRANSACTION_TYPE.BENEFIT_PAYMENT] ?? {
      count: 0,
      amountIn: 0,
      amountOut: 0,
    },
    recentTransactions,
  };
}

export async function listFundTransactions(query: FundTransactionsQuery) {
  const { page, pageSize } = query;
  const range = resolveDateRange(query);

  const where: Prisma.FundTransactionWhereInput = {
    ...(query.transactionType
      ? { transactionType: query.transactionType }
      : {}),
    ...(query.memberId ? { memberId: query.memberId } : {}),
    ...(range ? { transactionDate: { gte: range.from, lt: range.to } } : {}),
    ...(query.search
      ? {
          OR: [
            { note: { contains: query.search } },
            {
              member: {
                OR: [
                  { firstName: { contains: query.search } },
                  { lastName: { contains: query.search } },
                  { memberCode: { contains: query.search } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.fundTransaction.count({ where }),
    prisma.fundTransaction.findMany({
      where,
      include: {
        member: {
          select: {
            memberCode: true,
            prefix: true,
            firstName: true,
            lastName: true,
          },
        },
        fundAccount: { select: { accountName: true } },
      },
      orderBy: { transactionDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ---------------------------------------------------------------------------
// 4. Reports
// ---------------------------------------------------------------------------

async function periodOperations(range: DateRange) {
  const saleWhere = { status: "completed", ...saleDateFilter(range) };

  const [totals, byWasteTypeRaw] = await Promise.all([
    aggregateOperationTotalsForRange(range),
    prisma.wasteSaleDetail.groupBy({
      by: ["wasteTypeId"],
      where: { sale: saleWhere },
      _sum: { quantity: true, subtotal: true },
    }),
  ]);

  const wasteTypes = await prisma.wasteType.findMany({
    where: { id: { in: byWasteTypeRaw.map((row) => row.wasteTypeId) } },
  });
  const wasteTypeById = new Map(wasteTypes.map((wt) => [wt.id, wt]));

  return {
    completedSaleCount: totals.completedSaleCount,
    totalAmount: totals.totalAmount,
    totalFundDeduct: totals.totalFundDeduct,
    totalNetPaid: totals.totalNetPaid,
    totalQuantity: totals.totalQuantity,
    memberParticipatedCount: totals.memberParticipatedCount,
    byWasteType: byWasteTypeRaw
      .map((row) => ({
        wasteTypeId: row.wasteTypeId,
        wasteName:
          wasteTypeById.get(row.wasteTypeId)?.wasteName ??
          `#${row.wasteTypeId}`,
        unit: wasteTypeById.get(row.wasteTypeId)?.unit ?? "kg",
        quantity: row._sum.quantity ?? 0,
        amount: row._sum.subtotal ?? 0,
      }))
      .sort((a, b) => b.quantity - a.quantity),
  };
}

async function periodFund(range: DateRange) {
  const where = { transactionDate: { gte: range.from, lt: range.to } };

  const [totalsAgg, byTypeRaw, lastTransaction] = await Promise.all([
    prisma.fundTransaction.aggregate({
      where,
      _sum: { amountIn: true, amountOut: true },
    }),
    prisma.fundTransaction.groupBy({
      by: ["transactionType"],
      where,
      _count: { _all: true },
      _sum: { amountIn: true, amountOut: true },
    }),
    // balance_after of the last transaction on or before the period end =
    // the fund balance as it stood at the end of the reported period.
    prisma.fundTransaction.findFirst({
      where: { transactionDate: { lt: range.to } },
      orderBy: { transactionDate: "desc" },
    }),
  ]);

  return {
    totalIn: totalsAgg._sum.amountIn ?? 0,
    totalOut: totalsAgg._sum.amountOut ?? 0,
    net: (totalsAgg._sum.amountIn ?? 0) - (totalsAgg._sum.amountOut ?? 0),
    byType: Object.fromEntries(
      byTypeRaw.map((row) => [
        row.transactionType,
        {
          count: row._count._all,
          amountIn: row._sum.amountIn ?? 0,
          amountOut: row._sum.amountOut ?? 0,
        },
      ]),
    ),
    balanceAtPeriodEnd: lastTransaction?.balanceAfter ?? 0,
  };
}

// Reports can be requested for past periods, so "total" counts members who had
// applied by the *end of the reported period* (applyDate < range.to) - not the
// current row count, which would include members who joined after that period.
// Status changes are not timestamped, so a historical by-status breakdown cannot
// be reconstructed; the breakdown is exposed as an explicitly-named current
// snapshot instead.
async function periodMembers(range: DateRange) {
  const now = new Date();
  const [total, byStatusRaw, newInPeriod, approvedInPeriod] = await Promise.all(
    [
      prisma.member.count({ where: { applyDate: { lt: range.to } } }),
      prisma.member.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.member.count({
        where: { applyDate: { gte: range.from, lt: range.to } },
      }),
      prisma.member.count({
        where: { approvedDate: { gte: range.from, lt: range.to } },
      }),
    ],
  );

  return {
    total,
    currentByStatus: Object.fromEntries(
      byStatusRaw.map((row) => [row.status, row._count._all]),
    ),
    snapshotAsOf: now,
    newInPeriod,
    approvedInPeriod,
  };
}

export async function getMonthlyReport(query: MonthlyReportQuery) {
  const range = resolveDateRange({ year: query.year, month: query.month })!;
  const previousRange = resolveDateRange({
    year: query.month === 1 ? query.year - 1 : query.year,
    month: query.month === 1 ? 12 : query.month - 1,
  })!;

  const [members, operations, fund, previousOperations] = await Promise.all([
    periodMembers(range),
    periodOperations(range),
    periodFund(range),
    periodOperations(previousRange),
  ]);

  return {
    reportType: "monthly",
    period: {
      year: query.year,
      month: query.month,
      from: range.from,
      to: range.to,
    },
    generatedAt: new Date(),
    members,
    operations,
    fund,
    trends: {
      previousMonth: {
        completedSaleCount: previousOperations.completedSaleCount,
        totalAmount: previousOperations.totalAmount,
        totalQuantity: previousOperations.totalQuantity,
      },
      totalAmountChange:
        operations.totalAmount - previousOperations.totalAmount,
      totalQuantityChange:
        operations.totalQuantity - previousOperations.totalQuantity,
      saleCountChange:
        operations.completedSaleCount - previousOperations.completedSaleCount,
    },
  };
}

export async function getYearlyReport(query: YearlyReportQuery) {
  const range = resolveDateRange({ year: query.year })!;

  const [
    members,
    operations,
    fund,
    monthlySales,
    monthlyFund,
    co2MonthlySeries,
  ] = await Promise.all([
    periodMembers(range),
    periodOperations(range),
    periodFund(range),
    getMonthlySeries({ year: query.year }),
    getMonthlyFundSeries(range),
    getMonthlyCo2Series(range),
  ]);

  const salesByMonth = new Map(monthlySales.map((row) => [row.month, row]));
  const monthlyBreakdown = Array.from({ length: 12 }, (_, index) => {
    const key = `${query.year}-${String(index + 1).padStart(2, "0")}`;
    const sales = salesByMonth.get(key);
    const fund = monthlyFund.get(key);
    return {
      month: index + 1,
      saleCount: sales?.saleCount ?? 0,
      totalAmount: sales?.totalAmount ?? 0,
      fundDeductAmount: sales?.fundDeductAmount ?? 0,
      netAmount: sales?.netAmount ?? 0,
      quantity: sales?.quantity ?? 0,
      fundIn: fund?.amountIn ?? 0,
      fundOut: fund?.amountOut ?? 0,
    };
  });

  return {
    reportType: "yearly",
    period: { year: query.year, from: range.from, to: range.to },
    generatedAt: new Date(),
    members,
    operations,
    fund,
    monthlyBreakdown,
    co2MonthlySeries,
  };
}

export async function getExecutiveReport() {
  const now = new Date();
  // Rolling 6-month window (current month included) for the trend series.
  const sixMonthsRange: DateRange = {
    from: new Date(now.getFullYear(), now.getMonth() - 5, 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };

  const [
    membersSummary,
    fundSummary,
    allTimeOperations,
    trendSales,
    co2MonthlySeries,
  ] = await Promise.all([
    getMembersSummary(),
    getFundSummary(),
    periodOperations({ from: new Date(0), to: addDays(now, 1) }),
    prisma.wasteSale.findMany({
      where: { status: "completed", ...saleDateFilter(sixMonthsRange) },
      select: {
        saleDate: true,
        totalAmount: true,
        fundDeductAmount: true,
        netAmount: true,
        details: { select: { quantity: true } },
      },
    }),
    getMonthlyCo2Series(sixMonthsRange),
  ]);

  return {
    reportType: "executive",
    generatedAt: new Date(),
    members: membersSummary,
    operations: allTimeOperations,
    co2Credit: {
      ...buildCo2CreditSummary(allTimeOperations.byWasteType),
      monthlySeries: co2MonthlySeries,
    },
    fund: {
      totalBalance: fundSummary.totalBalance,
      totalIn: fundSummary.totalIn,
      totalOut: fundSummary.totalOut,
      contributionBalance: fundSummary.contributionBalance,
      minimumPerMember: fundSummary.minimumPerMember,
      activeMemberCount: fundSummary.activeMemberCount,
      belowMinimumCount: fundSummary.belowMinimumCount,
      byType: fundSummary.byType,
      welfarePayments: fundSummary.welfarePayments,
    },
    trends: {
      last6Months: buildMonthlySeries(trendSales),
      topWasteTypes: allTimeOperations.byWasteType.slice(0, 5),
    },
  };
}

// ---------------------------------------------------------------------------
// 5. PDF export report (เจ้าหน้าที่เทศบาล)
// ---------------------------------------------------------------------------
// One call returns every section the PDF builder on the frontend needs, so a
// report is always internally consistent (all sections computed from the same
// filters at the same moment). "หมู่บ้าน" is the member household's moo -
// the schema has no separate village table.

function villageLabel(moo: string | null, subdistrict: string | null): string {
  if (!moo) return "ไม่ระบุหมู่บ้าน";
  return subdistrict ? `หมู่ ${moo} ต.${subdistrict}` : `หมู่ ${moo}`;
}

export async function getPdfReportData(query: PdfReportQuery) {
  const range = resolveDateRange(query);

  const requestWhere = {
    ...(range ? { requestDate: { gte: range.from, lt: range.to } } : {}),
    ...(query.moo ? { member: { household: { moo: query.moo } } } : {}),
  };

  // The report's completed sales (with the seller's household), shared by
  // every breakdown below. Each breakdown is summed by the database, so only
  // the summary rows come back - never the sales themselves.
  const saleConditions: Prisma.Sql[] = [Prisma.sql`ws.status = 'completed'`];
  if (range) {
    saleConditions.push(Prisma.sql`ws.sale_date >= ${range.from}`);
    saleConditions.push(Prisma.sql`ws.sale_date < ${range.to}`);
  }
  if (query.moo) saleConditions.push(Prisma.sql`h.moo = ${query.moo}`);
  const reportSales = Prisma.sql`
    WITH s AS (
      SELECT ws.sale_id, ws.member_id, ws.round_id, ws.total_amount,
             ws.fund_deduct_amount, h.moo, h.subdistrict
      FROM waste_sale ws
      JOIN member m ON m.member_id = ws.member_id
      JOIN household h ON h.household_id = m.household_id
      WHERE ${Prisma.join(saleConditions, " AND ")}
    ),
    q AS (
      SELECT wsd.sale_id, SUM(wsd.quantity) AS quantity
      FROM waste_sale_detail wsd
      JOIN s ON s.sale_id = wsd.sale_id
      GROUP BY wsd.sale_id
    )`;

  const [
    memberCount,
    activeMemberCount,
    villageRows,
    overviewRows,
    roundRows,
    wasteTypeRows,
    villageSaleRows,
    requestsByStatus,
  ] = await Promise.all([
    prisma.member.count({
      where: query.moo ? { household: { moo: query.moo } } : {},
    }),
    prisma.member.count({
      where: {
        status: "active",
        ...(query.moo ? { household: { moo: query.moo } } : {}),
      },
    }),
    // One row per moo for the village dropdown, instead of every household.
    prisma.$queryRaw<{ moo: string; subdistrict: string | null }[]>`
      SELECT moo, mode() WITHIN GROUP (ORDER BY subdistrict) AS subdistrict
      FROM household
      WHERE moo IS NOT NULL AND moo <> ''
      GROUP BY moo
    `,
    prisma.$queryRaw<
      { saleCount: unknown; totalAmount: unknown; totalFundDeduct: unknown; totalQuantity: unknown }[]
    >`
      ${reportSales}
      SELECT
        COUNT(*) AS "saleCount",
        COALESCE(SUM(s.total_amount), 0) AS "totalAmount",
        COALESCE(SUM(s.fund_deduct_amount), 0) AS "totalFundDeduct",
        COALESCE(SUM(q.quantity), 0) AS "totalQuantity"
      FROM s
      LEFT JOIN q ON q.sale_id = s.sale_id
    `,
    prisma.$queryRaw<
      { roundDate: Date; locationNote: string | null; saleCount: unknown; quantity: unknown; amount: unknown }[]
    >`
      ${reportSales}
      SELECT
        cr.round_date AS "roundDate",
        cr.location_note AS "locationNote",
        COUNT(*) AS "saleCount",
        COALESCE(SUM(q.quantity), 0) AS quantity,
        COALESCE(SUM(s.total_amount), 0) AS amount
      FROM s
      JOIN collection_round cr ON cr.round_id = s.round_id
      LEFT JOIN q ON q.sale_id = s.sale_id
      GROUP BY cr.round_id, cr.round_date, cr.location_note
      ORDER BY cr.round_date ASC
    `,
    prisma.$queryRaw<{ wasteName: string; unit: string; quantity: unknown; amount: unknown }[]>`
      ${reportSales}
      SELECT
        wt.waste_name AS "wasteName",
        wt.unit,
        COALESCE(SUM(wsd.quantity), 0) AS quantity,
        COALESCE(SUM(wsd.subtotal), 0) AS amount
      FROM waste_sale_detail wsd
      JOIN s ON s.sale_id = wsd.sale_id
      JOIN waste_type wt ON wt.waste_type_id = wsd.waste_type_id
      GROUP BY wt.waste_type_id, wt.waste_name, wt.unit
    `,
    prisma.$queryRaw<
      {
        moo: string | null;
        subdistrict: string | null;
        sellerCount: unknown;
        quantity: unknown;
        amount: unknown;
        fundDeduct: unknown;
      }[]
    >`
      ${reportSales}
      SELECT
        s.moo,
        mode() WITHIN GROUP (ORDER BY s.subdistrict) AS subdistrict,
        COUNT(DISTINCT s.member_id) AS "sellerCount",
        COALESCE(SUM(q.quantity), 0) AS quantity,
        COALESCE(SUM(s.total_amount), 0) AS amount,
        COALESCE(SUM(s.fund_deduct_amount), 0) AS "fundDeduct"
      FROM s
      LEFT JOIN q ON q.sale_id = s.sale_id
      GROUP BY s.moo
    `,
    prisma.saleRequest.groupBy({
      by: ["status"],
      where: requestWhere,
      _count: { _all: true },
    }),
  ]);

  // --- village options (for the filter dropdown) + village count ------------
  const villageKeys = new Map<string, { moo: string; label: string }>();
  for (const row of villageRows) {
    villageKeys.set(row.moo, {
      moo: row.moo,
      label: villageLabel(row.moo, row.subdistrict),
    });
  }
  const villageOptions = [...villageKeys.values()].sort((a, b) =>
    a.moo.localeCompare(b.moo, "th", { numeric: true }),
  );

  // --- 1. overview -----------------------------------------------------------
  const totals = overviewRows[0];
  const overview = {
    memberCount,
    activeMemberCount,
    villageCount: query.moo ? 1 : villageKeys.size,
    totalQuantity: toNumber(totals?.totalQuantity),
    totalAmount: toNumber(totals?.totalAmount),
    totalFundDeduct: toNumber(totals?.totalFundDeduct),
    completedSaleCount: toNumber(totals?.saleCount),
  };

  // --- 2. purchases by round (วันที่ + พื้นที่) --------------------------------
  const purchasesByRound = roundRows.map((row) => ({
    roundDate: row.roundDate,
    area: row.locationNote ?? "ไม่ระบุพื้นที่",
    saleCount: toNumber(row.saleCount),
    quantity: toNumber(row.quantity),
    amount: toNumber(row.amount),
  }));

  // --- 3. by waste type -------------------------------------------------------
  const byWasteType = wasteTypeRows
    .map((row) => {
      const quantity = toNumber(row.quantity);
      const amount = toNumber(row.amount);
      return {
        wasteName: row.wasteName,
        unit: row.unit,
        quantity,
        amount,
        avgPrice: quantity > 0 ? Math.round((amount / quantity) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.quantity - a.quantity);

  // --- 4. by village ----------------------------------------------------------
  const byVillage = villageSaleRows
    .map((row) => ({
      village: villageLabel(row.moo, row.subdistrict),
      quantity: toNumber(row.quantity),
      amount: toNumber(row.amount),
      fundDeduct: toNumber(row.fundDeduct),
      sellerCount: toNumber(row.sellerCount),
    }))
    .sort((a, b) => b.amount - a.amount);

  // --- 5. sell-request status --------------------------------------------------
  const statusCount = Object.fromEntries(
    requestsByStatus.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const requestStatus = {
    total: requestsByStatus.reduce((sum, row) => sum + row._count._all, 0),
    requested: statusCount["requested"] ?? 0,
    confirmed: statusCount["confirmed"] ?? 0,
    completed: statusCount["completed"] ?? 0,
    cancelled: statusCount["cancelled"] ?? 0,
  };

  return {
    generatedAt: new Date(),
    filters: {
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      moo: query.moo ?? null,
      villageLabel: query.moo
        ? (villageKeys.get(query.moo)?.label ?? `หมู่ ${query.moo}`)
        : null,
    },
    villageOptions,
    overview,
    purchasesByRound,
    byWasteType,
    byVillage,
    requestStatus,
  };
}

// ---------------------------------------------------------------------------
// 6. Per-village summary (สรุปรายหมู่บ้าน)
// ---------------------------------------------------------------------------
// One row per village so the dashboard can compare them side by side on the
// three figures the municipality asks for: how much waste the village sold, the
// CO2 credit that waste earned, and the fund money it has accumulated.
//
// A village is the member household's moo (same rule as the PDF report - the
// member table has no village FK). village_area only supplies the name, when a
// household happens to be attached to one; households registered before their
// village row existed still group correctly on the moo they carry.
//
// All-time on purpose, with no date filter: member_fund_balance keeps no
// history, so its balance is only ever "now". Scoping the sales half to a period
// while the money half stayed current would put two different clocks in one row.

const NO_VILLAGE_KEY = "__none__";

interface VillageBucket {
  moo: string | null;
  villageName: string | null;
  subdistrict: string | null;
  memberCount: number;
  activeMemberCount: number;
  // Full status breakdown + household/new-member counts, so the dashboard's
  // "สถานะสมาชิก" donut can be redrawn for one village without another query.
  byStatus: Record<string, number>;
  householdCount: number;
  newThisMonth: number;
  contributionBalance: number;
  sellerCount: number;
  completedSaleCount: number;
  totalQuantity: number;
  totalAmount: number;
  totalFundDeduct: number;
  byWasteType: WasteTypeBreakdown[];
}

function villageFullLabel(
  bucket: Pick<VillageBucket, "moo" | "villageName" | "subdistrict">,
): string {
  if (!bucket.moo) return "ไม่ระบุหมู่บ้าน";
  const parts = [`หมู่ ${bucket.moo}`];
  if (bucket.villageName) parts.push(`บ้าน${bucket.villageName}`);
  if (bucket.subdistrict) parts.push(`ต.${bucket.subdistrict}`);
  return parts.join(" ");
}

// The village key every query below groups on: the household's trimmed moo,
// with a blank one counted as "no village" (NULL).
const villageMooSql = Prisma.sql`NULLIF(TRIM(h.moo), '')`;

interface RawVillageMembers {
  moo: string | null;
  villageName: string | null;
  subdistrict: string | null;
  memberCount: unknown;
  householdCount: unknown;
  newThisMonth: unknown;
  contributionBalance: unknown;
}

interface RawVillageStatus {
  moo: string | null;
  status: string;
  count: unknown;
}

interface RawVillageSales {
  moo: string | null;
  completedSaleCount: unknown;
  sellerCount: unknown;
  totalAmount: unknown;
  totalFundDeduct: unknown;
}

interface RawVillageWasteType {
  moo: string | null;
  wasteTypeId: unknown;
  wasteName: string;
  unit: string;
  quantity: unknown;
  amount: unknown;
}

export async function getVillageSummaryReport() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Every figure is summed per village by the database, so what comes back is
  // a handful of rows per village rather than every member and every sale.
  const [memberRows, statusRows, saleRows, wasteTypeRows] = await Promise.all([
    prisma.$queryRaw<RawVillageMembers[]>`
      SELECT
        ${villageMooSql} AS moo,
        -- Households in one moo do not always agree on the village row /
        -- subdistrict (or carry none), so the label takes the most common one.
        mode() WITHIN GROUP (ORDER BY va.village_name) AS "villageName",
        mode() WITHIN GROUP (ORDER BY NULLIF(h.subdistrict, '')) AS subdistrict,
        COUNT(*) AS "memberCount",
        COUNT(DISTINCT m.household_id) AS "householdCount",
        COUNT(*) FILTER (WHERE m.apply_date >= ${monthStart}) AS "newThisMonth",
        COALESCE(SUM(fb.total_contribution), 0) AS "contributionBalance"
      FROM member m
      JOIN household h ON h.household_id = m.household_id
      LEFT JOIN village_area va ON va.village_area_id = h.village_area_id
      LEFT JOIN member_fund_balance fb ON fb.member_id = m.member_id
      GROUP BY 1
    `,
    prisma.$queryRaw<RawVillageStatus[]>`
      SELECT ${villageMooSql} AS moo, m.status, COUNT(*) AS count
      FROM member m
      JOIN household h ON h.household_id = m.household_id
      GROUP BY 1, 2
    `,
    prisma.$queryRaw<RawVillageSales[]>`
      SELECT
        ${villageMooSql} AS moo,
        COUNT(*) AS "completedSaleCount",
        COUNT(DISTINCT ws.member_id) AS "sellerCount",
        COALESCE(SUM(ws.total_amount), 0) AS "totalAmount",
        COALESCE(SUM(ws.fund_deduct_amount), 0) AS "totalFundDeduct"
      FROM waste_sale ws
      JOIN member m ON m.member_id = ws.member_id
      JOIN household h ON h.household_id = m.household_id
      WHERE ws.status = 'completed'
      GROUP BY 1
    `,
    prisma.$queryRaw<RawVillageWasteType[]>`
      SELECT
        ${villageMooSql} AS moo,
        wsd.waste_type_id AS "wasteTypeId",
        wt.waste_name AS "wasteName",
        wt.unit,
        COALESCE(SUM(wsd.quantity), 0) AS quantity,
        COALESCE(SUM(wsd.subtotal), 0) AS amount
      FROM waste_sale_detail wsd
      JOIN waste_sale ws ON ws.sale_id = wsd.sale_id
      JOIN member m ON m.member_id = ws.member_id
      JOIN household h ON h.household_id = m.household_id
      JOIN waste_type wt ON wt.waste_type_id = wsd.waste_type_id
      WHERE ws.status = 'completed'
      GROUP BY 1, wsd.waste_type_id, wt.waste_name, wt.unit
    `,
  ]);

  const buckets = new Map<string, VillageBucket>();

  function bucketFor(moo: string | null): VillageBucket {
    const key = moo ?? NO_VILLAGE_KEY;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        moo,
        villageName: null,
        subdistrict: null,
        memberCount: 0,
        activeMemberCount: 0,
        byStatus: {},
        householdCount: 0,
        newThisMonth: 0,
        contributionBalance: 0,
        sellerCount: 0,
        completedSaleCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
        totalFundDeduct: 0,
        byWasteType: [],
      };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  for (const row of memberRows) {
    const bucket = bucketFor(row.moo);
    bucket.villageName = row.villageName;
    bucket.subdistrict = row.subdistrict;
    bucket.memberCount = toNumber(row.memberCount);
    bucket.householdCount = toNumber(row.householdCount);
    bucket.newThisMonth = toNumber(row.newThisMonth);
    bucket.contributionBalance = toNumber(row.contributionBalance);
  }

  for (const row of statusRows) {
    const bucket = bucketFor(row.moo);
    bucket.byStatus[row.status] = toNumber(row.count);
    if (row.status === "active") bucket.activeMemberCount = toNumber(row.count);
  }

  for (const row of saleRows) {
    const bucket = bucketFor(row.moo);
    bucket.completedSaleCount = toNumber(row.completedSaleCount);
    bucket.sellerCount = toNumber(row.sellerCount);
    bucket.totalAmount = toNumber(row.totalAmount);
    bucket.totalFundDeduct = toNumber(row.totalFundDeduct);
  }

  for (const row of wasteTypeRows) {
    const bucket = bucketFor(row.moo);
    const quantity = toNumber(row.quantity);
    bucket.totalQuantity += quantity;
    bucket.byWasteType.push({
      wasteTypeId: toNumber(row.wasteTypeId),
      wasteName: row.wasteName,
      unit: row.unit,
      quantity,
      amount: toNumber(row.amount),
    });
  }

  const villages = [...buckets.values()]
    .map((bucket) => {
      const co2 = buildCo2CreditSummary(bucket.byWasteType);
      return {
        moo: bucket.moo,
        villageName: bucket.villageName,
        subdistrict: bucket.subdistrict,
        // Short label for a chart axis, the long one for tooltips and tables.
        label: bucket.moo ? `หมู่ ${bucket.moo}` : "ไม่ระบุหมู่บ้าน",
        fullLabel: villageFullLabel(bucket),
        memberCount: bucket.memberCount,
        activeMemberCount: bucket.activeMemberCount,
        byStatus: bucket.byStatus,
        householdCount: bucket.householdCount,
        newThisMonth: bucket.newThisMonth,
        sellerCount: bucket.sellerCount,
        completedSaleCount: bucket.completedSaleCount,
        totalQuantity: bucket.totalQuantity,
        totalAmount: bucket.totalAmount,
        totalFundDeduct: bucket.totalFundDeduct,
        co2Credit: {
          totalWasteSold: co2.totalWasteSold,
          estimatedKgCo2e: co2.estimatedKgCo2e,
          estimatedTCo2e: co2.estimatedTCo2e,
          excludedWasteTypes: co2.excludedWasteTypes,
        },
        fund: {
          contributionBalance: bucket.contributionBalance,
        },
      };
    })
    // Numeric moo order, so a village keeps the same slot in every chart on the
    // page. Households with no moo go last - a data gap, not a village.
    .sort((a, b) => {
      if (a.moo === null) return b.moo === null ? 0 : 1;
      if (b.moo === null) return -1;
      return a.moo.localeCompare(b.moo, "th", { numeric: true });
    });

  const sum = (pick: (village: (typeof villages)[number]) => number) =>
    villages.reduce((total, village) => total + pick(village), 0);

  return {
    reportType: "villages" as const,
    generatedAt: new Date(),
    minimumPerMember: FUND_MINIMUM_BAHT,
    defaultEmissionReductionFactor: CO2_CREDIT_DEFAULT_FACTOR_KG_CO2E_PER_KG,
    villages,
    totals: {
      villageCount: villages.filter((village) => village.moo !== null).length,
      memberCount: sum((village) => village.memberCount),
      totalQuantity: sum((village) => village.totalQuantity),
      totalAmount: sum((village) => village.totalAmount),
      estimatedKgCo2e: sum((village) => village.co2Credit.estimatedKgCo2e),
      contributionBalance: sum((village) => village.fund.contributionBalance),
    },
  };
}

// --- Funeral (death) cases ---------------------------------------------------
// One case per deceased member (funeral_case), with one funeral_contribution
// row per member charged the 50-baht welfare contribution for that death. What
// the family receives is exactly what was collected: the sum of total_paid.

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function deceasedNameOf(member: {
  prefix: string | null;
  firstName: string;
  lastName: string;
}): string {
  return `${member.prefix ?? ""}${member.firstName} ${member.lastName}`.trim();
}

const funeralCaseMemberInclude = {
  deceasedMember: {
    select: {
      id: true,
      memberCode: true,
      citizenId: true,
      prefix: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      phone: true,
      household: {
        select: {
          houseNo: true,
          moo: true,
          subdistrict: true,
          district: true,
          province: true,
        },
      },
    },
  },
} satisfies Prisma.FuneralCaseInclude;

// เงินสะสมของผู้เสียชีวิตเองที่ถูกปิดบัญชีเข้ากองทุนตอนแจ้งเสียชีวิต อ่านจากสมุดบัญชี
// กองทุน (fund_transaction ของเคสนั้นที่ member_id = ผู้เสียชีวิต) จึงตรงกับเงินที่
// เคลื่อนจริงเสมอ เคสเก่าที่บันทึกก่อนมีกติกานี้จะได้ 0 ตามความเป็นจริง
async function deceasedOwnSavingsOf(caseIds: number[]): Promise<Map<number, number>> {
  if (!caseIds.length) return new Map();

  const rows = await prisma.fundTransaction.findMany({
    where: {
      funeralCaseId: { in: caseIds },
      funeralCase: { deceasedMemberId: { not: undefined } },
    },
    select: { funeralCaseId: true, memberId: true, amountOut: true, funeralCase: { select: { deceasedMemberId: true } } },
  });

  const totals = new Map<number, number>();
  for (const row of rows) {
    if (row.funeralCaseId === null) continue;
    if (row.memberId !== row.funeralCase?.deceasedMemberId) continue;
    totals.set(row.funeralCaseId, roundMoney((totals.get(row.funeralCaseId) ?? 0) + (row.amountOut ?? 0)));
  }
  return totals;
}

export async function listFuneralCases(query: FuneralCaseListQuery) {
  const { page, pageSize } = query;

  // Same range rule as every other municipality list: `to` is exclusive, so a
  // dateTo of the 30th still includes everything recorded on the 30th.
  const range = resolveDateRange({
    ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
    ...(query.dateTo ? { dateTo: query.dateTo } : {}),
  });

  const deceasedWhere: Prisma.MemberWhereInput = {
    ...(query.search ? memberSearchWhere(query.search) : {}),
    ...(query.villageAreaId ? { household: { villageAreaId: query.villageAreaId } } : {}),
  };

  const where: Prisma.FuneralCaseWhereInput = {
    ...(Object.keys(deceasedWhere).length ? { deceasedMember: deceasedWhere } : {}),
    ...(range ? { deathDate: { gte: range.from, lt: range.to } } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  // Page ids come from `cases`; matchedIds covers every filtered case so the
  // summary cards add up the whole filter, not just the page on screen.
  const [total, cases, matched, contributionSums] = await Promise.all([
    prisma.funeralCase.count({ where }),
    prisma.funeralCase.findMany({
      where,
      include: {
        ...funeralCaseMemberInclude,
        contributions: {
          select: { totalPaid: true, shortfall: true, status: true },
        },
      },
      orderBy: [{ deathDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.funeralCase.findMany({ where, select: { id: true } }),
    prisma.funeralContribution.aggregate({
      where: { funeralCase: where },
      _sum: { totalPaid: true, shortfall: true },
    }),
  ]);

  const ownSavings = await deceasedOwnSavingsOf(matched.map((funeralCase) => funeralCase.id));
  const ownSavingsTotal = [...ownSavings.values()].reduce((sum, amount) => sum + amount, 0);

  const items = cases.map((funeralCase) => {
    const { contributions, deceasedMember, ...rest } = funeralCase;
    return {
      ...rest,
      deceasedMember: {
        ...deceasedMember,
        fullName: deceasedNameOf(deceasedMember),
      },
      summary: summarizeContributions(
        contributions,
        funeralCase.requiredAmount,
        ownSavings.get(funeralCase.id) ?? 0,
      ),
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    totals: {
      totalPayout: roundMoney((contributionSums._sum.totalPaid ?? 0) + ownSavingsTotal),
      totalShortfall: roundMoney(contributionSums._sum.shortfall ?? 0),
    },
  };
}

export async function getFuneralCaseDetail(caseId: number) {
  const funeralCase = await prisma.funeralCase.findUnique({
    where: { id: caseId },
    include: {
      ...funeralCaseMemberInclude,
      contributions: {
        include: {
          member: {
            select: {
              id: true,
              memberCode: true,
              prefix: true,
              firstName: true,
              lastName: true,
              household: {
                select: {
                  moo: true,
                  villageArea: { select: { id: true, villageName: true, moo: true } },
                },
              },
            },
          },
        },
        orderBy: { member: { memberCode: "asc" } },
      },
    },
  });

  if (!funeralCase) {
    throw ApiError.notFound("Funeral case not found");
  }

  const { contributions, deceasedMember, ...rest } = funeralCase;
  const isPending = funeralCase.status === FUNERAL_CASE_STATUS.PENDING;

  const [ownSavings, certificate, staff, approval] = await Promise.all([
    deceasedOwnSavingsOf([funeralCase.id]),
    // The certificate the committee attached to the report - what the officer
    // checks before approving.
    prisma.memberDocument.findFirst({
      where: { memberId: funeralCase.deceasedMemberId, documentType: "death_certificate" },
      orderBy: { uploadedAt: "desc" },
      select: { originalName: true, mimeType: true, storagePath: true },
    }),
    prisma.userAccount.findMany({
      where: {
        id: {
          in: [funeralCase.recordedBy, funeralCase.approvedBy].filter(
            (id): id is number => id !== null,
          ),
        },
      },
      select: { id: true, fullName: true },
    }),
    // What approving would do right now (charge whom, or own savings only).
    isPending ? previewFuneralApproval(funeralCase.deceasedMemberId) : null,
  ]);
  const staffName = (id: number | null) =>
    staff.find((account) => account.id === id)?.fullName ?? null;

  return {
    ...rest,
    deceasedMember: {
      ...deceasedMember,
      fullName: deceasedNameOf(deceasedMember),
    },
    reportedByName: staffName(funeralCase.recordedBy),
    approvedByName: staffName(funeralCase.approvedBy),
    deathCertificate: certificate
      ? {
          originalName: certificate.originalName,
          mimeType: certificate.mimeType,
          fileUrl: await privateFileUrl("memberDocuments", certificate.storagePath),
        }
      : null,
    approval,
    summary: summarizeContributions(
      contributions,
      funeralCase.requiredAmount,
      ownSavings.get(funeralCase.id) ?? 0,
    ),
    villageBreakdown: summarizeContributionsByVillage(
      contributions,
      funeralCase.requiredAmount,
    ),
    contributions: contributions.map((contribution) => ({
      id: contribution.id,
      memberId: contribution.memberId,
      memberCode: contribution.member.memberCode,
      fullName: deceasedNameOf(contribution.member),
      moo: contribution.member.household?.moo ?? null,
      requiredAmount: contribution.requiredAmount,
      totalPaid: contribution.totalPaid,
      shortfall: contribution.shortfall,
      status: contribution.status,
      balanceAfter: contribution.personalFundBalanceAfter,
      createdAt: contribution.createdAt,
    })),
  };
}

// How many members were charged, how many actually paid the full rate, and what
// the deceased member's family receives (= what was collected).
function summarizeContributions(
  contributions: { totalPaid: number; shortfall: number; status: string }[],
  requiredAmount: number,
  // เงินสะสมของผู้เสียชีวิตเองที่ถูกปิดบัญชีเข้ากองทุนตอนแจ้งเสียชีวิต
  deceasedOwnSavings = 0,
) {
  const paidInFull = contributions.filter(
    (contribution) => contribution.status === FUNERAL_CONTRIBUTION_STATUS.COMPLETED,
  ).length;
  const partiallyPaid = contributions.filter(
    (contribution) => contribution.status === FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID,
  ).length;
  const unpaid = contributions.filter(
    (contribution) => contribution.status === FUNERAL_CONTRIBUTION_STATUS.SHORTFALL_REMAINING,
  ).length;

  return {
    requiredAmount,
    chargedMemberCount: contributions.length,
    paidInFullCount: paidInFull,
    partiallyPaidCount: partiallyPaid,
    unpaidCount: unpaid,
    // เก็บจากสมาชิกคนอื่นได้เท่าไร, ผู้เสียชีวิตปิดบัญชีเงินสะสมมาเท่าไร และรวมแล้ว
    // ทายาทได้รับเท่าไร (totalPayout = ยอดที่จ่ายให้ทายาทจริง)
    totalCollected: roundMoney(
      contributions.reduce((sum, contribution) => sum + contribution.totalPaid, 0),
    ),
    deceasedOwnSavings: roundMoney(deceasedOwnSavings),
    totalPayout: roundMoney(
      contributions.reduce((sum, contribution) => sum + contribution.totalPaid, 0) +
        deceasedOwnSavings,
    ),
    totalShortfall: roundMoney(
      contributions.reduce((sum, contribution) => sum + contribution.shortfall, 0),
    ),
    expectedTotal: roundMoney(contributions.length * requiredAmount),
  };
}

interface VillageContributionInput {
  totalPaid: number;
  shortfall: number;
  status: string;
  member: {
    household: {
      moo: string | null;
      villageArea: { id: number; villageName: string; moo: string | null } | null;
    } | null;
  };
}

// The same contributions as above, split by the village each payer lives in -
// "how much did each village put in for this one death".
// Grouped on village_area_id, not household.moo: moo is display text (two
// households can carry the same string, and renaming one must not merge
// villages), while the village FK is the key every other village-scoped query
// uses. Payers whose household is not attached to a village yet collapse into
// one unassigned row so the per-village totals still add up to the case total.
function summarizeContributionsByVillage(
  contributions: VillageContributionInput[],
  requiredAmount: number,
) {
  const UNASSIGNED = "unassigned";
  const groups = new Map<
    number | typeof UNASSIGNED,
    {
      villageAreaId: number | null;
      villageName: string | null;
      moo: string | null;
      memberCount: number;
      paidInFullCount: number;
      partiallyPaidCount: number;
      unpaidCount: number;
      totalPaid: number;
      totalShortfall: number;
    }
  >();

  for (const contribution of contributions) {
    const village = contribution.member.household?.villageArea ?? null;
    const key = village?.id ?? UNASSIGNED;

    let group = groups.get(key);
    if (!group) {
      group = {
        villageAreaId: village?.id ?? null,
        villageName: village?.villageName ?? null,
        moo: village?.moo ?? contribution.member.household?.moo ?? null,
        memberCount: 0,
        paidInFullCount: 0,
        partiallyPaidCount: 0,
        unpaidCount: 0,
        totalPaid: 0,
        totalShortfall: 0,
      };
      groups.set(key, group);
    }

    group.memberCount += 1;
    group.totalPaid += contribution.totalPaid;
    group.totalShortfall += contribution.shortfall;
    if (contribution.status === FUNERAL_CONTRIBUTION_STATUS.COMPLETED) {
      group.paidInFullCount += 1;
    } else if (contribution.status === FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID) {
      group.partiallyPaidCount += 1;
    } else {
      group.unpaidCount += 1;
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      totalPaid: roundMoney(group.totalPaid),
      totalShortfall: roundMoney(group.totalShortfall),
      expectedTotal: roundMoney(group.memberCount * requiredAmount),
    }))
    // By moo number ("2" before "10"), with the unassigned row last.
    .sort((a, b) => {
      const left = Number(a.moo);
      const right = Number(b.moo);
      if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
      if (Number.isFinite(left)) return -1;
      if (Number.isFinite(right)) return 1;
      return (a.villageName ?? "").localeCompare(b.villageName ?? "", "th");
    });
}
