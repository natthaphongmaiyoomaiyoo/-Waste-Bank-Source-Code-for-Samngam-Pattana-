import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import {
  activeMonthKeysInWindow,
  checkAllMembersEligibility,
  checkMemberEligibility,
  eligibilityWindowStart,
  evaluateEligibility,
  getMemberEligibility,
} from '../src/services/eligibilityService.js';
import { createMember } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// Fixed "today" so window math never depends on when the suite runs:
// 15 Aug 2026 -> window = Sep 2025..Aug 2026 (12 calendar months).
const NOW = new Date(2026, 7, 15);

// Six non-consecutive months inside that window.
const SIX_SCATTERED_WINDOW_MONTHS = [
  new Date(2026, 6, 5),
  new Date(2026, 4, 20),
  new Date(2026, 2, 12),
  new Date(2026, 0, 8),
  new Date(2025, 10, 18),
  new Date(2025, 8, 3),
];

let saleSeq = 0;

// One completed sale on `saleDate`. Buyer + round are required FKs; eligibility
// only reads waste_sale.sale_date + status.
async function createSale(memberId: number, saleDate: Date, status = 'completed') {
  saleSeq += 1;
  const buyer = await prisma.buyer.create({ data: { buyerName: `Elig Buyer ${saleSeq}` } });
  const round = await prisma.collectionRound.create({
    data: {
      roundDate: saleDate,
      startTime: '08:00',
      endTime: '10:00',
      buyerId: buyer.id,
      status: 'completed',
    },
  });
  return prisma.wasteSale.create({
    data: {
      saleNo: `ELIG-${saleSeq}`,
      memberId,
      roundId: round.id,
      buyerId: buyer.id,
      saleDate,
      totalAmount: 100,
      netAmount: 100,
      status,
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('evaluateEligibility (pure rule)', () => {
  it('passes when all three conditions are met (fund 120, 8 months, 6 active months)', () => {
    const result = evaluateEligibility({ fundBalance: 120, membershipMonths: 8, activeMonths: 6 });
    expect(result.eligible).toBe(true);
    expect(result.fundCheck).toEqual({ passed: true, amount: 120, required: 50 });
    expect(result.membershipAgeCheck).toEqual({ passed: true, months: 8, required: 6 });
    expect(result.wasteSaleActivityCheck).toEqual({
      passed: true,
      activeMonths: 6,
      required: 6,
      windowMonths: 12,
    });
    expect(result.reason).toEqual([]);
  });

  it('fails on fund alone even when the other checks pass (fund 40, 10 months, 7 active)', () => {
    const result = evaluateEligibility({ fundBalance: 40, membershipMonths: 10, activeMonths: 7 });
    expect(result.eligible).toBe(false);
    expect(result.fundCheck.passed).toBe(false);
    expect(result.membershipAgeCheck.passed).toBe(true);
    expect(result.wasteSaleActivityCheck.passed).toBe(true);
    expect(result.reason).toHaveLength(1);
    expect(result.reason[0]).toContain('เงินสะสม');
  });

  it('treats the thresholds as inclusive (exactly 50 baht / 6 months / 6 active months)', () => {
    const result = evaluateEligibility({ fundBalance: 50, membershipMonths: 6, activeMonths: 6 });
    expect(result.eligible).toBe(true);
  });

  it('fails with 5 active sale months - one short of the 6 required', () => {
    const result = evaluateEligibility({ fundBalance: 50, membershipMonths: 6, activeMonths: 5 });
    expect(result.eligible).toBe(false);
    expect(result.wasteSaleActivityCheck).toMatchObject({ passed: false, activeMonths: 5, required: 6 });
    expect(result.reason).toHaveLength(1);
  });

  it('lists one reason per failed condition', () => {
    const result = evaluateEligibility({ fundBalance: 0, membershipMonths: 0, activeMonths: 0 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toHaveLength(3);
  });
});

describe('eligibility window helpers', () => {
  it('window starts at the 1st of the oldest of the 12 calendar months', () => {
    expect(eligibilityWindowStart(NOW)).toEqual(new Date(2025, 8, 1));
  });

  it('counts a month with many sales as one active month', () => {
    const keys = activeMonthKeysInWindow(
      [new Date(2026, 6, 1), new Date(2026, 6, 15), new Date(2026, 6, 30)],
      NOW,
    );
    expect(keys.size).toBe(1);
  });

  it('includes the window boundary day and excludes anything older', () => {
    const keys = activeMonthKeysInWindow(
      [
        new Date(2025, 8, 1), // 1 Sep 2025 - first day of the window, counts
        new Date(2025, 7, 31), // 31 Aug 2025 - one day before the window, ignored
        new Date(2024, 6, 10), // over two years old, ignored
      ],
      NOW,
    );
    expect([...keys]).toEqual(['2025-09']);
  });
});

describe('getMemberEligibility (member self-view)', () => {
  it('returns the same result as checkMemberEligibility without writing a snapshot row', async () => {
    const member = await createMember({ totalContribution: 120 });
    await prisma.member.update({
      where: { id: member.id },
      data: { approvedDate: new Date(2025, 11, 15) },
    });
    for (const saleDate of SIX_SCATTERED_WINDOW_MONTHS) await createSale(member.id, saleDate);

    const result = await getMemberEligibility(member.id, NOW);

    expect(result.eligible).toBe(true);
    expect(result.activeMonthCount).toBe(6);
    expect(result.membershipMonths).toBe(8);
    expect(await prisma.eligibilityCheck.count()).toBe(0);

    const recorded = await checkMemberEligibility(member.id, { now: NOW });
    const { checkId: _checkId, checkDate: _recordedDate, ...recordedRest } = recorded;
    const { checkDate: _readDate, ...readRest } = result;
    expect(readRest).toEqual(recordedRest);
  });

  it('buckets sales into months by server-local time, like monthKey', async () => {
    const member = await createMember({ totalContribution: 120 });
    // Five hours apart, but on either side of local midnight on 1 Aug 2026 -
    // still the same UTC day (31 Jul) in a UTC+ timezone.
    await createSale(member.id, new Date(2026, 6, 31, 22, 0));
    await createSale(member.id, new Date(2026, 7, 1, 3, 0));

    const result = await getMemberEligibility(member.id, NOW);

    const expected = activeMonthKeysInWindow(
      [new Date(2026, 6, 31, 22, 0), new Date(2026, 7, 1, 3, 0)],
      NOW,
    ).size;
    expect(result.activeMonthCount).toBe(expected);
  });
});

describe('checkMemberEligibility', () => {
  it('passes a member with fund 120, 8 months tenure, sales in 6 scattered window months', async () => {
    const member = await createMember({ totalContribution: 120 });
    await prisma.member.update({
      where: { id: member.id },
      data: { approvedDate: new Date(2025, 11, 15) }, // 15 Dec 2025 -> 8 whole months
    });
    // Scattered active months (Jul / May / Mar / Jan 2026, Nov / Sep 2025) - not
    // consecutive on purpose.
    for (const saleDate of SIX_SCATTERED_WINDOW_MONTHS) await createSale(member.id, saleDate);

    const result = await checkMemberEligibility(member.id, { now: NOW });

    expect(result.eligible).toBe(true);
    expect(result.membershipAgeCheck.months).toBe(8);
    expect(result.wasteSaleActivityCheck.activeMonths).toBe(6);
    expect(result.reason).toEqual([]);

    // A snapshot row is recorded for history.
    const rows = await prisma.eligibilityCheck.findMany({ where: { memberId: member.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.isEligible).toBe(true);
    expect(rows[0]!.activeMonthCount).toBe(6);
  });

  it('fails a member with no sales at all', async () => {
    const member = await createMember({ totalContribution: 100 });
    await prisma.member.update({
      where: { id: member.id },
      data: { approvedDate: new Date(2025, 0, 1) },
    });

    const result = await checkMemberEligibility(member.id, { now: NOW });

    expect(result.eligible).toBe(false);
    expect(result.wasteSaleActivityCheck).toMatchObject({ passed: false, activeMonths: 0 });
    expect(result.reason).toHaveLength(1);
  });

  it('fails a just-registered member (no approvedDate yet) on membership age', async () => {
    const member = await createMember({ totalContribution: 100, status: 'pending' });

    const result = await checkMemberEligibility(member.id, { now: NOW });

    expect(result.membershipAgeCheck).toMatchObject({ passed: false, months: 0 });
    expect(result.eligible).toBe(false);
  });

  it('ignores active months that fall outside the 12-month window', async () => {
    const member = await createMember({ totalContribution: 100 });
    await prisma.member.update({
      where: { id: member.id },
      data: { approvedDate: new Date(2024, 0, 1) },
    });
    // Six distinct sale months, all 13-18 months before NOW -> zero in-window.
    for (let month = 2; month <= 7; month += 1) {
      await createSale(member.id, new Date(2025, month, 10));
    }

    const result = await checkMemberEligibility(member.id, { now: NOW });

    expect(result.wasteSaleActivityCheck).toMatchObject({ passed: false, activeMonths: 0 });
    expect(result.eligible).toBe(false);
  });

  it('counts many transactions in the same month as one active month', async () => {
    const member = await createMember({ totalContribution: 100 });
    await createSale(member.id, new Date(2026, 6, 1));
    await createSale(member.id, new Date(2026, 6, 10));
    await createSale(member.id, new Date(2026, 6, 25));

    const result = await checkMemberEligibility(member.id, { now: NOW });

    expect(result.wasteSaleActivityCheck.activeMonths).toBe(1);
  });

  it('ignores cancelled sales', async () => {
    const member = await createMember({ totalContribution: 100 });
    await createSale(member.id, new Date(2026, 6, 1), 'cancelled');

    const result = await checkMemberEligibility(member.id, { now: NOW });

    expect(result.wasteSaleActivityCheck.activeMonths).toBe(0);
  });

  it('counts a whole membership month only once the same day-of-month is reached (mid-month apply)', async () => {
    // Approved 15 Feb 2026, NOW = 15 Aug 2026 -> exactly 6 whole months: pass.
    const onTheDay = await createMember({ totalContribution: 100 });
    await prisma.member.update({
      where: { id: onTheDay.id },
      data: { approvedDate: new Date(2026, 1, 15) },
    });

    // Approved 16 Feb 2026 -> the 6th month completes on 16 Aug, so still 5: fail.
    const oneDayShort = await createMember({ totalContribution: 100 });
    await prisma.member.update({
      where: { id: oneDayShort.id },
      data: { approvedDate: new Date(2026, 1, 16) },
    });

    const passed = await checkMemberEligibility(onTheDay.id, { now: NOW });
    const failed = await checkMemberEligibility(oneDayShort.id, { now: NOW });

    expect(passed.membershipAgeCheck).toMatchObject({ passed: true, months: 6 });
    expect(failed.membershipAgeCheck).toMatchObject({ passed: false, months: 5 });
  });

  it('throws 404 for an unknown member', async () => {
    await expect(checkMemberEligibility(999999, { now: NOW })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('checkAllMembersEligibility (admin batch)', () => {
  it('evaluates every active member without writing snapshot rows', async () => {
    const passing = await createMember({ totalContribution: 120 });
    await prisma.member.update({
      where: { id: passing.id },
      data: { approvedDate: new Date(2025, 11, 15) },
    });
    for (const saleDate of SIX_SCATTERED_WINDOW_MONTHS) await createSale(passing.id, saleDate);

    // Same activity/tenure but 40 baht -> fails on fund only.
    const lowFund = await createMember({ totalContribution: 40 });
    await prisma.member.update({
      where: { id: lowFund.id },
      data: { approvedDate: new Date(2025, 9, 1) },
    });
    for (let month = 2; month <= 7; month += 1) {
      await createSale(lowFund.id, new Date(2026, month, 5));
    }

    // Pending applicants are not members yet -> not in the batch at all.
    await createMember({ totalContribution: 100, status: 'pending' });

    const overview = await checkAllMembersEligibility(NOW);

    expect(overview.windowMonths).toBe(12);
    expect(overview.summary).toEqual({ total: 2, eligible: 1, notEligible: 1 });

    const passingRow = overview.results.find((r) => r.memberId === passing.id);
    const lowFundRow = overview.results.find((r) => r.memberId === lowFund.id);
    expect(passingRow?.eligible).toBe(true);
    expect(passingRow?.reason).toEqual([]);
    expect(lowFundRow?.eligible).toBe(false);
    expect(lowFundRow?.fundCheck).toMatchObject({ passed: false, amount: 40 });
    expect(lowFundRow?.membershipAgeCheck.passed).toBe(true);
    expect(lowFundRow?.wasteSaleActivityCheck.passed).toBe(true);

    expect(await prisma.eligibilityCheck.count()).toBe(0);
  });
});
