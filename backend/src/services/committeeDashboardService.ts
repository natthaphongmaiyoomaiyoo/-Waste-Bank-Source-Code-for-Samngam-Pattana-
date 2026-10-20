import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import {
  COLLECTION_ROUND_STATUS,
  ELIGIBILITY_MONTHS_REQUIRED,
  FUNERAL_CASE_STATUS,
  FUNERAL_CONTRIBUTION_STATUS,
  FUND_MINIMUM_BAHT,
  FUND_TRANSACTION_TYPE,
  MEMBER_STATUS,
  SALE_REQUEST_STATUS,
} from '../config/constants.js';
import { evaluateMembersEligibility } from './eligibilityService.js';
import { memberScopeWhere, roundScopeWhere } from './villageScopeService.js';
import type { VillageScope } from '../middleware/villageScope.js';

// Overview dashboard for the Waste Bank / Village Committee role - the numbers
// the committee plans and approves against, in one read.
//
// Everything is village-scoped exactly like the rest of the committee API
// (memberScopeWhere / roundScopeWhere): a committee sees only its own village,
// `null` scope (admin) sees every village. Money totals are therefore summed
// from the village's own member_fund_balance rows rather than read off the
// shared fund_account, which is municipality-wide and would leak other
// villages' balances into this page.
//
// Sample lists (atRiskMembers / belowMinimumMembers) are capped at SAMPLE_SIZE:
// the dashboard shows who to act on first and links to the full member page for
// the rest, so the payload stays small no matter how big the village is.

const SAMPLE_SIZE = 5;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function fullNameOf(member: {
  prefix: string | null;
  firstName: string;
  lastName: string;
}) {
  return `${member.prefix ?? ''}${member.firstName} ${member.lastName}`.trim();
}

export async function getDashboard(scope: VillageScope | null, now: Date = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const todayStart = startOfDay(now);
  const thisMonth = { gte: monthStart, lt: nextMonthStart };

  const memberWhere = memberScopeWhere(scope);
  // `{ member: {} }` is a valid no-op relation filter, but the rest of the
  // codebase spells the admin case out as "no filter at all" - keep it identical
  // so the queries here read the same as committeeSellRequestService's.
  const scopedByMember = scope ? { member: memberWhere } : {};
  const saleWhere: Prisma.WasteSaleWhereInput = {
    status: 'completed',
    saleDate: thisMonth,
    ...scopedByMember,
  };

  const [
    byStatusRaw,
    newThisMonth,
    activeMembers,
    fundAgg,
    monthRequestsRaw,
    monthSaleAgg,
    monthQuantityAgg,
    monthContributionAgg,
    requestStatusRaw,
    funeralContributionRaw,
    funeralCasesThisMonth,
  ] = await Promise.all([
    prisma.member.groupBy({ by: ['status'], _count: { _all: true }, where: memberWhere }),
    prisma.member.count({ where: { AND: [memberWhere, { applyDate: thisMonth }] } }),
    prisma.member.findMany({
      where: { AND: [memberWhere, { status: MEMBER_STATUS.ACTIVE }] },
      select: {
        id: true,
        memberCode: true,
        prefix: true,
        firstName: true,
        lastName: true,
        phone: true,
        approvedDate: true,
        fundBalance: { select: { totalContribution: true } },
      },
    }),
    // Money actually held for this village, across every member (a resigned
    // member's leftover savings is still the fund's liability).
    prisma.memberFundBalance.aggregate({
      where: scope ? { member: memberWhere } : {},
      _sum: { totalContribution: true },
    }),
    // One row per member who filed at least one sell request this month, so the
    // row count is "สมาชิกที่แจ้งขาย" and the count sum is the request total.
    prisma.saleRequest.groupBy({
      by: ['memberId'],
      _count: { _all: true },
      where: { requestDate: thisMonth, ...scopedByMember },
    }),
    prisma.wasteSale.aggregate({
      where: saleWhere,
      _count: { _all: true },
      _sum: { totalAmount: true, fundDeductAmount: true, netAmount: true },
    }),
    // Weight comes off the line items - waste_sale itself only stores money.
    prisma.wasteSaleDetail.aggregate({ where: { sale: saleWhere }, _sum: { quantity: true } }),
    // Money that went into members' savings this month: the automatic top-up
    // plus whatever sellers chose to keep.
    prisma.fundTransaction.aggregate({
      where: {
        transactionType: { in: [FUND_TRANSACTION_TYPE.CONTRIBUTION, FUND_TRANSACTION_TYPE.DEPOSIT] },
        transactionDate: thisMonth,
        ...scopedByMember,
      },
      _count: { _all: true },
      _sum: { amountIn: true },
    }),
    prisma.saleRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: scopedByMember,
    }),
    // Funeral contributions this village still owes (the collection runs
    // automatically when a member is marked deceased, and books a shortfall
    // whenever the member could not cover the full 50 baht).
    prisma.funeralContribution.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { shortfall: true },
      where: {
        status: {
          in: [
            FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID,
            FUNERAL_CONTRIBUTION_STATUS.SHORTFALL_REMAINING,
          ],
        },
        ...scopedByMember,
      },
    }),
    prisma.funeralCase.count({
      where: {
        // A report the municipality hasn't approved yet isn't a death on record.
        status: FUNERAL_CASE_STATUS.APPROVED,
        eventDate: thisMonth,
        ...(scope ? { deceasedMember: memberWhere } : {}),
      },
    }),
  ]);

  // --- Members -------------------------------------------------------------

  const byStatus = Object.fromEntries(byStatusRaw.map((row) => [row.status, row._count._all]));
  const totalMembers = byStatusRaw.reduce((sum, row) => sum + row._count._all, 0);

  const evaluations = await evaluateMembersEligibility(activeMembers, now);

  const belowMinimumMembers: Array<{
    id: number;
    memberCode: string;
    fullName: string;
    phone: string;
    contribution: number;
    shortfall: number;
  }> = [];
  const atRiskMembers: Array<{
    id: number;
    memberCode: string;
    fullName: string;
    phone: string;
    contribution: number;
    activeMonths: number;
    requiredMonths: number;
    reasons: string[];
  }> = [];
  let benefitEligible = 0;

  for (const member of activeMembers) {
    const contribution = member.fundBalance?.totalContribution ?? 0;

    if (contribution < FUND_MINIMUM_BAHT) {
      belowMinimumMembers.push({
        id: member.id,
        memberCode: member.memberCode,
        fullName: fullNameOf(member),
        phone: member.phone,
        contribution: roundMoney(contribution),
        shortfall: roundMoney(FUND_MINIMUM_BAHT - contribution),
      });
    }

    const evaluation = evaluations.get(member.id);
    if (!evaluation?.eligible) continue;
    benefitEligible += 1;

    // "ใกล้ขาดสิทธิ" = passes today, but with no buffer left on a condition:
    //  - sold in exactly the minimum number of active months, so the oldest one
    //    rolling out of the 12-month window drops them below the rule; or
    //  - holds less than two funeral contributions' worth of savings, so the
    //    next death event alone takes them under the 50-baht minimum.
    const reasons: string[] = [];
    const activeMonths = evaluation.wasteSaleActivityCheck.activeMonths;
    if (activeMonths === ELIGIBILITY_MONTHS_REQUIRED) {
      reasons.push(
        `ขายขยะครบขั้นต่ำพอดี ${activeMonths} เดือน หากเดือนที่เก่าที่สุดหลุดออกจากช่วง ${evaluation.wasteSaleActivityCheck.windowMonths} เดือน จะขาดสิทธิทันที`,
      );
    }
    if (contribution < FUND_MINIMUM_BAHT * 2) {
      reasons.push(
        `เงินสะสมคงเหลือ ${contribution.toLocaleString()} บาท หากถูกหักฌาปนกิจอีก ${FUND_MINIMUM_BAHT} บาท จะต่ำกว่าเกณฑ์`,
      );
    }
    if (reasons.length === 0) continue;

    atRiskMembers.push({
      id: member.id,
      memberCode: member.memberCode,
      fullName: fullNameOf(member),
      phone: member.phone,
      contribution: roundMoney(contribution),
      activeMonths,
      requiredMonths: ELIGIBILITY_MONTHS_REQUIRED,
      reasons,
    });
  }

  // Most urgent first: fewest active months, then the thinnest fund.
  atRiskMembers.sort((a, b) => a.activeMonths - b.activeMonths || a.contribution - b.contribution);
  belowMinimumMembers.sort((a, b) => b.shortfall - a.shortfall);

  const totalBalance = roundMoney(fundAgg._sum.totalContribution ?? 0);
  const activeCount = activeMembers.length;
  const belowMinimumCount = belowMinimumMembers.length;

  // --- Current round, area groups and route plans ---------------------------

  const roundInclude = {
    buyer: { select: { id: true, buyerName: true, phone: true } },
    villageArea: { select: { id: true, villageName: true, moo: true } },
  };

  // "รอบปัจจุบัน" = the next round still to be worked; once none is left
  // planned, the most recent round is what the committee is still closing out.
  const currentRound =
    (await prisma.collectionRound.findFirst({
      where: {
        ...roundScopeWhere(scope),
        status: COLLECTION_ROUND_STATUS.PLANNED,
        roundDate: { gte: todayStart },
      },
      include: roundInclude,
      orderBy: [{ roundDate: 'asc' }, { startTime: 'asc' }],
    })) ??
    (await prisma.collectionRound.findFirst({
      where: { ...roundScopeWhere(scope), status: { not: COLLECTION_ROUND_STATUS.CANCELLED } },
      include: roundInclude,
      orderBy: [{ roundDate: 'desc' }, { startTime: 'desc' }],
    }));

  const roundRequests = currentRound
    ? await prisma.saleRequest.findMany({
        where: { roundId: currentRound.id, ...scopedByMember },
        select: {
          id: true,
          memberId: true,
          status: true,
          estimatedQuantity: true,
          pickupLat: true,
          pickupLng: true,
          member: {
            select: { household: { select: { moo: true, villageAreaId: true } } },
          },
          routeStops: { select: { id: true } },
        },
      })
    : [];

  const groupMap = new Map<
    string,
    { label: string; requestCount: number; members: Set<number>; estimatedQuantity: number; plannedCount: number }
  >();
  let plannedRequestCount = 0;
  let readyToPlanCount = 0;
  let missingLocationCount = 0;

  for (const request of roundRequests) {
    const moo = request.member.household?.moo?.trim() ?? '';
    const key = moo || 'unassigned';
    let group = groupMap.get(key);
    if (!group) {
      group = {
        label: moo ? `หมู่ ${moo}` : 'ยังไม่ระบุพื้นที่',
        requestCount: 0,
        members: new Set<number>(),
        estimatedQuantity: 0,
        plannedCount: 0,
      };
      groupMap.set(key, group);
    }
    group.requestCount += 1;
    group.members.add(request.memberId);
    group.estimatedQuantity += request.estimatedQuantity;

    const inPlan = request.routeStops.length > 0;
    if (inPlan) {
      group.plannedCount += 1;
      plannedRequestCount += 1;
    }

    // Only a confirmed request is plannable, and only with a pinned location -
    // the two counters below are exactly what the route-plan page can act on.
    if (!inPlan && request.status === SALE_REQUEST_STATUS.CONFIRMED) {
      if (request.pickupLat !== null && request.pickupLng !== null) {
        readyToPlanCount += 1;
      } else {
        missingLocationCount += 1;
      }
    }
  }

  const areaGroups = [...groupMap.values()]
    .map((group) => ({
      label: group.label,
      requestCount: group.requestCount,
      memberCount: group.members.size,
      estimatedQuantity: roundMoney(group.estimatedQuantity),
      plannedCount: group.plannedCount,
    }))
    .sort((a, b) => b.requestCount - a.requestCount);

  const roundPlans = currentRound
    ? await prisma.pickupRoutePlan.findMany({
        where: {
          ...(scope ? { villageAreaId: scope.villageAreaId } : {}),
          stops: { some: { request: { roundId: currentRound.id } } },
        },
        select: {
          id: true,
          planDate: true,
          status: true,
          totalDistanceKm: true,
          buyer: { select: { id: true, buyerName: true } },
          stops: { select: { status: true } },
        },
        orderBy: { id: 'desc' },
      })
    : [];

  const routePlans = roundPlans.map((plan) => {
    const collected = plan.stops.filter((stop) => stop.status === 'collected').length;
    return {
      id: plan.id,
      planDate: plan.planDate,
      status: plan.status,
      buyerName: plan.buyer?.buyerName ?? null,
      totalDistanceKm: plan.totalDistanceKm,
      stopCount: plan.stops.length,
      collectedCount: collected,
    };
  });

  // --- Sell requests, approvals --------------------------------------------

  const requestByStatus = Object.fromEntries(
    requestStatusRaw.map((row) => [row.status, row._count._all]),
  );

  const funeralShortfallCount = funeralContributionRaw.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const funeralShortfallAmount = roundMoney(
    funeralContributionRaw.reduce((sum, row) => sum + (row._sum.shortfall ?? 0), 0),
  );

  const monthRequestCount = monthRequestsRaw.reduce((sum, row) => sum + row._count._all, 0);

  return {
    generatedAt: now,
    village: scope
      ? { id: scope.villageAreaId, villageName: scope.villageName, moo: scope.moo }
      : null,
    month: { start: monthStart, end: nextMonthStart },

    // 1. กองทุนรวม / เงินสะสม
    fund: {
      totalBalance,
      minimumPerMember: FUND_MINIMUM_BAHT,
      activeMemberCount: activeCount,
      // How much of "every active member holds at least 50 baht" is actually met.
      requiredTotal: roundMoney(activeCount * FUND_MINIMUM_BAHT),
      belowMinimumCount,
      belowMinimumShortfall: roundMoney(
        belowMinimumMembers.reduce((sum, row) => sum + row.shortfall, 0),
      ),
      fullyContributedCount: activeCount - belowMinimumCount,
    },

    // 2. สถิติประจำเดือน
    monthly: {
      sellRequestMemberCount: monthRequestsRaw.length,
      sellRequestCount: monthRequestCount,
      wasteQuantity: roundMoney(monthQuantityAgg._sum.quantity ?? 0),
      completedSaleCount: monthSaleAgg._count._all,
      saleAmount: roundMoney(monthSaleAgg._sum.totalAmount ?? 0),
      netPaidAmount: roundMoney(monthSaleAgg._sum.netAmount ?? 0),
      fundContribution: roundMoney(monthContributionAgg._sum.amountIn ?? 0),
      fundContributionCount: monthContributionAgg._count._all,
      newMemberCount: newThisMonth,
      funeralCaseCount: funeralCasesThisMonth,
    },

    // 3. คำขอขายขยะ + การจัดกลุ่มพื้นที่ + เส้นทางรับซื้อรอบปัจจุบัน
    sellRequests: {
      total: requestStatusRaw.reduce((sum, row) => sum + row._count._all, 0),
      byStatus: requestByStatus,
      waitingReview: requestByStatus[SALE_REQUEST_STATUS.REQUESTED] ?? 0,
      confirmed: requestByStatus[SALE_REQUEST_STATUS.CONFIRMED] ?? 0,
    },
    currentRound: currentRound
      ? {
          id: currentRound.id,
          roundDate: currentRound.roundDate,
          startTime: currentRound.startTime,
          endTime: currentRound.endTime,
          status: currentRound.status,
          locationNote: currentRound.locationNote,
          buyer: currentRound.buyer,
          villageArea: currentRound.villageArea,
          requestCount: roundRequests.length,
          plannedRequestCount,
          readyToPlanCount,
          missingLocationCount,
        }
      : null,
    areaGroups,
    routePlans,

    // 4. คำขอที่รอกรรมการตรวจสอบ/อนุมัติ
    approvals: {
      funeralShortfallCount,
      funeralShortfallAmount,
    },

    // 5. สถานะสมาชิก
    members: {
      total: totalMembers,
      byStatus,
      pendingApproval: byStatus[MEMBER_STATUS.PENDING] ?? 0,
      activeCount,
      benefitEligible,
      atRiskCount: atRiskMembers.length,
      atRiskMembers: atRiskMembers.slice(0, SAMPLE_SIZE),
      belowMinimumCount,
      belowMinimumMembers: belowMinimumMembers.slice(0, SAMPLE_SIZE),
    },
  };
}
