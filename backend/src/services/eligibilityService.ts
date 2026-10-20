import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import {
  ELIGIBILITY_MONTHS_REQUIRED,
  ELIGIBILITY_WINDOW_MONTHS,
  FUND_MINIMUM_BAHT,
  MEMBER_STATUS,
  MEMBERSHIP_TENURE_MONTHS_REQUIRED,
} from '../config/constants.js';
import { monthsSince } from '../utils/age.js';

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// First day of the oldest month inside the rolling check window (the current
// calendar month plus the ELIGIBILITY_WINDOW_MONTHS - 1 months before it).
export function eligibilityWindowStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - (ELIGIBILITY_WINDOW_MONTHS - 1), 1);
}

// Distinct calendar months inside the window that have at least one sale - a
// month with many sales still counts as one active month.
export function activeMonthKeysInWindow(saleDates: Date[], now: Date = new Date()): Set<string> {
  const start = eligibilityWindowStart(now);
  const keys = new Set<string>();
  for (const date of saleDates) {
    if (date >= start) keys.add(monthKey(date));
  }
  return keys;
}

// Longest run of consecutive calendar months, ending at the most recent month
// with a completed sale, that the member sold waste in. Recorded on the
// eligibility_check row for reference/history only - it no longer gates the
// decision (active months don't need to be consecutive).
export function longestRecentStreak(monthKeys: string[]): number {
  if (monthKeys.length === 0) return 0;

  const sorted = [...new Set(monthKeys)].sort().reverse();
  let streak = 1;
  let [year, month] = sorted[0]!.split('-').map(Number) as [number, number];

  for (let i = 1; i < sorted.length; i++) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    const expected = `${year}-${String(month).padStart(2, '0')}`;
    if (sorted[i] === expected) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export interface EligibilityEvaluation {
  eligible: boolean;
  fundCheck: { passed: boolean; amount: number; required: number };
  membershipAgeCheck: { passed: boolean; months: number; required: number };
  wasteSaleActivityCheck: {
    passed: boolean;
    activeMonths: number;
    required: number;
    windowMonths: number;
  };
  reason: string[];
}

// Pure decision rule: savings >= 50 AND membership >= 6 months AND >= 6 active
// sale months within the last 12 calendar months. `reason` lists (in Thai) every
// condition that failed; empty array means the member passes.
export function evaluateEligibility(input: {
  fundBalance: number;
  membershipMonths: number;
  activeMonths: number;
}): EligibilityEvaluation {
  const fundCheck = {
    passed: input.fundBalance >= FUND_MINIMUM_BAHT,
    amount: input.fundBalance,
    required: FUND_MINIMUM_BAHT,
  };
  const membershipAgeCheck = {
    passed: input.membershipMonths >= MEMBERSHIP_TENURE_MONTHS_REQUIRED,
    months: input.membershipMonths,
    required: MEMBERSHIP_TENURE_MONTHS_REQUIRED,
  };
  const wasteSaleActivityCheck = {
    passed: input.activeMonths >= ELIGIBILITY_MONTHS_REQUIRED,
    activeMonths: input.activeMonths,
    required: ELIGIBILITY_MONTHS_REQUIRED,
    windowMonths: ELIGIBILITY_WINDOW_MONTHS,
  };

  const reason: string[] = [];
  if (!fundCheck.passed) {
    reason.push(`เงินสะสม ${fundCheck.amount} บาท ต่ำกว่าขั้นต่ำ ${fundCheck.required} บาท`);
  }
  if (!membershipAgeCheck.passed) {
    reason.push(
      `อายุสมาชิก ${membershipAgeCheck.months} เดือน ยังไม่ครบ ${membershipAgeCheck.required} เดือน`,
    );
  }
  if (!wasteSaleActivityCheck.passed) {
    reason.push(
      `ขายขยะเพียง ${wasteSaleActivityCheck.activeMonths} เดือน จากที่ต้องมีอย่างน้อย ${wasteSaleActivityCheck.required} เดือน ใน ${wasteSaleActivityCheck.windowMonths} เดือนล่าสุด`,
    );
  }

  return {
    eligible: fundCheck.passed && membershipAgeCheck.passed && wasteSaleActivityCheck.passed,
    fundCheck,
    membershipAgeCheck,
    wasteSaleActivityCheck,
    reason,
  };
}

// The timezone monthKey() buckets in (the server's), handed to SQL so the
// database groups sales into exactly the same calendar months.
const SERVER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Distinct active sale months inside the window for each member, worked out by
// the database: at most one row per member per month comes back instead of
// every sale row. Members with no sale in the window have no entry.
async function activeMonthKeysByMember(
  memberIds: number[],
  now: Date,
): Promise<Map<number, Set<string>>> {
  const keysByMember = new Map<number, Set<string>>();
  if (memberIds.length === 0) return keysByMember;

  const rows = await prisma.$queryRaw<{ memberId: number; month: string }[]>`
    SELECT DISTINCT
      member_id AS "memberId",
      to_char((sale_date AT TIME ZONE 'UTC') AT TIME ZONE ${SERVER_TIME_ZONE}, 'YYYY-MM') AS month
    FROM waste_sale
    WHERE member_id = ANY(${memberIds}::int[])
      AND status = 'completed'
      AND sale_date >= ${eligibilityWindowStart(now)}
  `;

  for (const row of rows) {
    let keys = keysByMember.get(row.memberId);
    if (!keys) {
      keys = new Set<string>();
      keysByMember.set(row.memberId, keys);
    }
    keys.add(row.month);
  }
  return keysByMember;
}

// One member's evaluation plus the figures the eligibility endpoints echo back.
async function evaluateOneMember(memberId: number, now: Date) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { fundBalance: true },
  });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  const activeKeys = (await activeMonthKeysByMember([memberId], now)).get(memberId) ?? new Set<string>();
  // Whole months the member has been approved. Not yet approved -> 0 months.
  const membershipMonths = member.approvedDate ? monthsSince(member.approvedDate, now) : 0;
  const fundBalance = member.fundBalance?.totalContribution ?? 0;

  const evaluation = evaluateEligibility({
    fundBalance,
    membershipMonths,
    activeMonths: activeKeys.size,
  });

  return { evaluation, activeKeys, membershipMonths };
}

// The member's own view (GET /eligibility, loaded on every member page): same
// result as checkMemberEligibility, but read-only - opening a page must not
// write an eligibility_check row each time.
export async function getMemberEligibility(memberId: number, now: Date = new Date()) {
  const { evaluation, activeKeys, membershipMonths } = await evaluateOneMember(memberId, now);

  return {
    ...evaluation,
    memberId,
    checkDate: now,
    isEligible: evaluation.eligible,
    activeMonthCount: activeKeys.size,
    continuousMonthCount: longestRecentStreak([...activeKeys]),
    membershipMonths,
  };
}

// Full check for one member: reads the fund balance and only the sales inside
// the window, records an eligibility_check snapshot row, and returns the
// structured result. `now` is injectable for tests; `checkedBy` records which
// user account triggered the check (admin drill-down).
export async function checkMemberEligibility(
  memberId: number,
  options?: { checkedBy?: number | undefined; now?: Date | undefined },
) {
  const now = options?.now ?? new Date();
  const { evaluation, activeKeys, membershipMonths } = await evaluateOneMember(memberId, now);

  const check = await prisma.eligibilityCheck.create({
    data: {
      memberId,
      activeMonthCount: activeKeys.size,
      continuousMonthCount: longestRecentStreak([...activeKeys]),
      isEligible: evaluation.eligible,
      reason: evaluation.reason.length ? evaluation.reason.join('; ') : 'ผ่านคุณสมบัติครบทุกเงื่อนไข',
      checkedBy: options?.checkedBy ?? null,
    },
  });

  return {
    ...evaluation,
    memberId,
    checkId: check.id,
    checkDate: check.checkDate,
    // Flat legacy fields, the same set getMemberEligibility returns to the
    // member dashboard (memberProfileStore).
    isEligible: evaluation.eligible,
    activeMonthCount: check.activeMonthCount,
    continuousMonthCount: check.continuousMonthCount,
    membershipMonths,
  };
}

export interface EligibilityInputMember {
  id: number;
  approvedDate: Date | null;
  fundBalance: { totalContribution: number } | null;
}

// Batch evaluation for an already-fetched set of members (the admin overview
// below, one page of the committee member list, ...). One extra query no matter
// how many members are passed in, and no snapshot rows written - a list view
// would otherwise spam eligibility_check with one row per member per refresh.
// Members not in the list simply have no entry in the returned map.
export async function evaluateMembersEligibility(
  members: EligibilityInputMember[],
  now: Date = new Date(),
): Promise<Map<number, EligibilityEvaluation>> {
  const evaluations = new Map<number, EligibilityEvaluation>();
  if (members.length === 0) return evaluations;

  const monthKeysByMember = await activeMonthKeysByMember(
    members.map((member) => member.id),
    now,
  );

  for (const member of members) {
    evaluations.set(
      member.id,
      evaluateEligibility({
        fundBalance: member.fundBalance?.totalContribution ?? 0,
        membershipMonths: member.approvedDate ? monthsSince(member.approvedDate, now) : 0,
        activeMonths: monthKeysByMember.get(member.id)?.size ?? 0,
      }),
    );
  }

  return evaluations;
}

// Batch check for the admin dashboard: every active member, two queries total.
export async function checkAllMembersEligibility(now: Date = new Date()) {
  const members = await prisma.member.findMany({
    where: { status: MEMBER_STATUS.ACTIVE },
    select: {
      id: true,
      memberCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      approvedDate: true,
      fundBalance: { select: { totalContribution: true } },
    },
    orderBy: { memberCode: 'asc' },
  });

  const evaluations = await evaluateMembersEligibility(members, now);

  const results = members.map((member) => ({
    memberId: member.id,
    memberCode: member.memberCode,
    fullName: `${member.prefix ?? ''}${member.firstName} ${member.lastName}`.trim(),
    ...evaluations.get(member.id)!,
  }));

  const eligibleCount = results.filter((r) => r.eligible).length;

  return {
    checkedAt: now.toISOString(),
    windowMonths: ELIGIBILITY_WINDOW_MONTHS,
    summary: {
      total: results.length,
      eligible: eligibleCount,
      notEligible: results.length - eligibleCount,
    },
    results,
  };
}
