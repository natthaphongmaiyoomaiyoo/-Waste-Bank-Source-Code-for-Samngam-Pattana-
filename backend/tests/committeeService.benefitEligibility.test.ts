import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { getMemberDetail, getMembersSummary, listMembers } from '../src/services/committeeService.js';
import { createMember, makeMemberFuneralEligible } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// The member-management page shows, per row, whether a member currently meets
// every condition for claiming money from the funeral fund (fund >= 50 baht,
// 6 months of membership, 6 active sale months in the last 12). The list, the
// detail and the summary count all have to agree on that answer.

const listQuery = { page: 1, pageSize: 20 };

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('committeeService fund-claim eligibility', () => {
  it('flags a member who meets every condition', async () => {
    const member = await createMember({ totalContribution: 50 });
    await makeMemberFuneralEligible(member.id);

    const listed = (await listMembers(listQuery, null)).items.find((item) => item.id === member.id);
    expect(listed?.benefitEligibility?.eligible).toBe(true);
    expect(listed?.benefitEligibility?.reason).toEqual([]);

    // The detail dialog reads the same evaluation off the detail endpoint.
    const detail = await getMemberDetail(member.id, null);
    expect(detail.benefitEligibility?.eligible).toBe(true);
  });

  it('reports which conditions a member still fails', async () => {
    const member = await createMember({ totalContribution: 20 });

    const listed = (await listMembers(listQuery, null)).items.find((item) => item.id === member.id);
    const eligibility = listed?.benefitEligibility;

    expect(eligibility?.eligible).toBe(false);
    expect(eligibility?.fundCheck).toMatchObject({ passed: false, amount: 20, required: 50 });
    expect(eligibility?.membershipAgeCheck.passed).toBe(false);
    expect(eligibility?.wasteSaleActivityCheck).toMatchObject({ passed: false, activeMonths: 0 });
    expect(eligibility?.reason).toHaveLength(3);
  });

  it('leaves the evaluation out for anyone who is not an active member', async () => {
    const applicant = await createMember({ totalContribution: 100, status: 'pending' });
    await makeMemberFuneralEligible(applicant.id);

    const listed = (await listMembers(listQuery, null)).items.find((item) => item.id === applicant.id);
    // Passes the money/tenure/activity rule on paper, but can't claim at all.
    expect(listed?.benefitEligibility).toBeNull();
  });

  it('counts the eligible active members in the summary', async () => {
    const eligible = await createMember({ totalContribution: 50 });
    await makeMemberFuneralEligible(eligible.id);
    // Same profile but never approved as a member -> not counted.
    const pending = await createMember({ totalContribution: 50, status: 'pending' });
    await makeMemberFuneralEligible(pending.id);
    // Active, but the fund contribution is short.
    await createMember({ totalContribution: 10 });

    const summary = await getMembersSummary(null);
    expect(summary.total).toBe(3);
    expect(summary.benefitEligible).toBe(1);
  });
});
