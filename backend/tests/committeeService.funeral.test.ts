import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { approveFuneralCase, reportMemberDeath } from '../src/services/funeralCaseService.js';
import { FUNERAL_CONTRIBUTION_STATUS } from '../src/config/constants.js';
import { createFundAccount, createMember, makeMemberFuneralEligible } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// Minimal stand-in for the uploaded death-certificate file. reportMemberDeath
// only reads filename/originalname/mimetype/size off it to create the
// MemberDocument row.
const deathCertificate = {
  filename: 'death-cert-test.pdf',
  originalname: 'death-cert.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  buffer: Buffer.from('test-death-certificate'),
} as Express.Multer.File;

const deceasedInput = { deathDate: '2026-07-25', causeOfDeath: 'ทดสอบระบบ' };

const COMMITTEE_USER = 1;
const MUNICIPALITY_USER = 2;

// The committee reports (null scope = admin / unrestricted; village isolation is
// covered by villageScope.test.ts), then the municipality approves.
async function reportAndApprove(
  memberId: number,
  input: { deathDate: string; causeOfDeath: string; note?: string } = deceasedInput,
  approval: { ownSavingsOnly?: boolean } = {},
) {
  const report = await reportMemberDeath(memberId, input, deathCertificate, COMMITTEE_USER, null);
  return approveFuneralCase(report.funeralCaseId, approval, MUNICIPALITY_USER);
}

const savingsOf = async (memberId: number) =>
  (await prisma.memberFundBalance.findUniqueOrThrow({ where: { memberId } })).totalContribution;

const statusOf = async (memberId: number) =>
  (await prisma.member.findUniqueOrThrow({ where: { id: memberId } })).status;

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('funeralCaseService.reportMemberDeath (committee report)', () => {
  it('only records a pending case: the member stays active and no money moves', async () => {
    const fund = await createFundAccount(1000);
    const deceased = await createMember({ totalContribution: 100 });
    await makeMemberFuneralEligible(deceased.id);
    const other = await createMember({ totalContribution: 80, withUserAccount: true });

    const report = await reportMemberDeath(
      deceased.id,
      { ...deceasedInput, note: 'แจ้งโดยญาติ' },
      deathCertificate,
      COMMITTEE_USER,
      null,
    );

    expect(report.status).toBe('pending');
    expect(report.eligibility.isEligible).toBe(true);
    const funeralCase = await prisma.funeralCase.findUniqueOrThrow({ where: { id: report.funeralCaseId } });
    expect(funeralCase.status).toBe('pending');
    expect(funeralCase.reportNote).toBe('แจ้งโดยญาติ');
    expect(funeralCase.recordedBy).toBe(COMMITTEE_USER);
    expect(funeralCase.approvedAt).toBeNull();

    expect(await statusOf(deceased.id)).toBe('active');
    expect(await savingsOf(deceased.id)).toBe(100);
    expect(await savingsOf(other.id)).toBe(80);
    expect(await prisma.funeralContribution.count()).toBe(0);
    expect(await prisma.fundTransaction.count({ where: { funeralCaseId: report.funeralCaseId } })).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
    expect((await prisma.fundAccount.findUniqueOrThrow({ where: { id: fund.id } })).balance).toBe(1000);

    const certificate = await prisma.memberDocument.findFirst({
      where: { memberId: deceased.id, documentType: 'death_certificate' },
    });
    expect(certificate).not.toBeNull();
  });

  it('refuses a second report while the first is waiting for approval', async () => {
    const deceased = await createMember({ totalContribution: 100 });
    await reportMemberDeath(deceased.id, deceasedInput, deathCertificate, COMMITTEE_USER, null);

    await expect(
      reportMemberDeath(deceased.id, deceasedInput, deathCertificate, COMMITTEE_USER, null),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await prisma.funeralCase.count()).toBe(1);
  });
});

describe('funeralCaseService.approveFuneralCase (funeral fund collection)', () => {
  it('charges every active member, notifying only those left with a shortfall', async () => {
    await createFundAccount(100000);

    const deceased = await createMember({ totalContribution: 100 });
    await makeMemberFuneralEligible(deceased.id);

    const fullyCovered = await createMember({ totalContribution: 50, withUserAccount: true });
    const wellOff = await createMember({ totalContribution: 170, withUserAccount: true });
    // Savings under 50 baht are still taken as far as they go.
    const shortMember = await createMember({ totalContribution: 10, withUserAccount: true });
    const brokeMember = await createMember({ totalContribution: 0, withUserAccount: true });

    const result = await reportAndApprove(deceased.id, { ...deceasedInput, note: 'test death' });

    expect(await statusOf(deceased.id)).toBe('deceased');
    expect(result.deduction.memberCount).toBe(4);
    expect(result.deduction.completedCount).toBe(2);
    expect(result.deduction.partiallyPaidCount).toBe(1);
    expect(result.deduction.shortfallRemainingCount).toBe(1);
    expect(result.deduction.totalDeducted).toBe(50 + 50 + 10 + 0);

    const funeralCase = await prisma.funeralCase.findUniqueOrThrow({ where: { id: result.funeralCaseId } });
    expect(funeralCase.status).toBe('approved');
    expect(funeralCase.approvedBy).toBe(MUNICIPALITY_USER);
    expect(funeralCase.approvedAt).not.toBeNull();
    expect(funeralCase.requiredAmount).toBe(50);

    const contributions = await prisma.funeralContribution.findMany({
      where: { funeralCaseId: result.funeralCaseId },
      orderBy: { memberId: 'asc' },
    });
    expect(contributions).toHaveLength(4);

    const byMember = new Map(contributions.map((c) => [c.memberId, c]));
    expect(byMember.get(fullyCovered.id)?.status).toBe(FUNERAL_CONTRIBUTION_STATUS.COMPLETED);
    expect(byMember.get(wellOff.id)?.status).toBe(FUNERAL_CONTRIBUTION_STATUS.COMPLETED);
    expect(byMember.get(wellOff.id)?.personalFundBalanceAfter).toBe(120);
    expect(byMember.get(shortMember.id)?.status).toBe(FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID);
    expect(byMember.get(shortMember.id)?.shortfall).toBe(40);
    expect(byMember.get(brokeMember.id)?.status).toBe(FUNERAL_CONTRIBUTION_STATUS.SHORTFALL_REMAINING);
    expect(byMember.get(brokeMember.id)?.shortfall).toBe(50);

    expect(await savingsOf(fullyCovered.id)).toBe(0);
    expect(await savingsOf(wellOff.id)).toBe(120);
    expect(await savingsOf(shortMember.id)).toBe(0);

    // Every payer gets the general "you were charged" notification...
    const generalNotifications = await prisma.notification.findMany({
      where: { notificationType: 'funeral' },
      include: { user: { select: { memberId: true } } },
    });
    expect(generalNotifications).toHaveLength(4);
    expect(generalNotifications.every((notification) => notification.message.includes('50'))).toBe(true);
    expect(generalNotifications.every((notification) => notification.message.includes(deceased.firstName))).toBe(
      true,
    );
    const funeralNoticeByMember = new Map(
      generalNotifications.map((notification) => [notification.user?.memberId, notification.message]),
    );
    expect(funeralNoticeByMember.get(fullyCovered.id)).toContain('หักเงินฌาปนกิจจากเงินสะสมของท่าน 50 บาทแล้ว');
    expect(funeralNoticeByMember.get(shortMember.id)).toContain('ระบบหักจากเงินสะสมได้ 10 บาท');

    // ...but only the two who ended up short get the shortfall notice, and
    // its message states the remaining amount owed.
    const shortfallNotifications = await prisma.notification.findMany({
      where: { title: 'เงินสะสมไม่พอหักเงินฌาปนกิจ' },
      include: { user: { select: { memberId: true } } },
    });
    expect(shortfallNotifications).toHaveLength(2);
    const shortfallByMember = new Map(
      shortfallNotifications.map((n) => [n.user?.memberId, n.message]),
    );
    expect(shortfallByMember.get(shortMember.id)).toContain('40');
    expect(shortfallByMember.get(brokeMember.id)).toContain('50');
  });

  it('writes one fund ledger row per paying member, chaining the fund balance in member-code order', async () => {
    const fund = await createFundAccount(1000);

    const deceased = await createMember({ totalContribution: 100 });
    await makeMemberFuneralEligible(deceased.id);
    const payers = [
      await createMember({ totalContribution: 80 }),
      await createMember({ totalContribution: 20 }),
      await createMember({ totalContribution: 0 }),
      await createMember({ totalContribution: 50 }),
    ];

    const result = await reportAndApprove(deceased.id);

    // Charge order = the payer query's memberCode order, read back from the DB
    // so the expectation follows the database's own collation.
    const chargeOrder = await prisma.member.findMany({
      where: { id: { in: payers.map((payer) => payer.id) } },
      orderBy: { memberCode: 'asc' },
      select: { id: true },
    });
    const charged = new Map([
      [payers[0]!.id, 50],
      [payers[1]!.id, 20],
      [payers[3]!.id, 50],
    ]);
    const expectedRows = chargeOrder
      .filter((member) => charged.has(member.id))
      .map((member) => ({ memberId: member.id, amountOut: charged.get(member.id)! }));

    const rows = await prisma.fundTransaction.findMany({
      where: { funeralCaseId: result.funeralCaseId, memberId: { not: deceased.id } },
      orderBy: { id: 'asc' },
    });
    expect(rows.map(({ memberId, amountOut }) => ({ memberId, amountOut }))).toEqual(expectedRows);

    let running = 1000;
    for (const row of rows) {
      running -= row.amountOut;
      expect(row.balanceAfter).toBe(running);
    }

    const deceasedSavings = result.deduction.deceasedOwnSavings;
    const account = await prisma.fundAccount.findUniqueOrThrow({ where: { id: fund.id } });
    expect(account.balance).toBe(1000 - 120 - deceasedSavings);

    expect(await savingsOf(payers[0]!.id)).toBe(30);
    expect(await savingsOf(payers[1]!.id)).toBe(0);
    expect(await savingsOf(payers[2]!.id)).toBe(0);
    expect(await savingsOf(payers[3]!.id)).toBe(0);
  });

  it('is idempotent per payer even if the same case is charged again directly (duplicate deduction prevention)', async () => {
    await createFundAccount(100000);

    const deceased = await createMember({ totalContribution: 100 });
    await makeMemberFuneralEligible(deceased.id);
    const payer = await createMember({ totalContribution: 50 });

    const result = await reportAndApprove(deceased.id);

    const { chargeFuneralContribution } = await import('../src/services/funeralFundService.js');
    const repeat = await chargeFuneralContribution({
      funeralCaseId: result.funeralCaseId,
      memberId: payer.id,
      requiredAmount: 50,
      recordedBy: 1,
    });
    expect(repeat.alreadyProcessed).toBe(true);

    const balance = await prisma.memberFundBalance.findUnique({ where: { memberId: payer.id } });
    expect(balance?.totalContribution).toBe(0);

    const rows = await prisma.funeralContribution.findMany({
      where: { funeralCaseId: result.funeralCaseId, memberId: payer.id },
    });
    expect(rows).toHaveLength(1);
  });

  it('refuses to approve the same case twice', async () => {
    await createFundAccount(1000);
    const deceased = await createMember({ totalContribution: 100 });
    await makeMemberFuneralEligible(deceased.id);
    const payer = await createMember({ totalContribution: 80 });

    const result = await reportAndApprove(deceased.id);
    await expect(approveFuneralCase(result.funeralCaseId, {}, MUNICIPALITY_USER)).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(await savingsOf(payer.id)).toBe(30);
    expect(await prisma.funeralContribution.count({ where: { memberId: payer.id } })).toBe(1);
  });

  it('does not charge a member who is reported dead and still waiting for approval', async () => {
    await createFundAccount(1000);
    const deceased = await createMember({ totalContribution: 100 });
    await makeMemberFuneralEligible(deceased.id);
    const alsoReported = await createMember({ totalContribution: 80 });
    await reportMemberDeath(alsoReported.id, deceasedInput, deathCertificate, COMMITTEE_USER, null);
    const payer = await createMember({ totalContribution: 80 });

    const result = await reportAndApprove(deceased.id);

    expect(result.deduction.memberCount).toBe(1);
    expect(await savingsOf(alsoReported.id)).toBe(80);
    expect(await savingsOf(payer.id)).toBe(30);
    expect(await statusOf(alsoReported.id)).toBe('active');
  });
});

describe('funeralCaseService.approveFuneralCase (member not meeting the funeral conditions)', () => {
  it('refuses until the officer confirms the own-savings-only payout', async () => {
    await createFundAccount(1000);
    // Never made eligible: no membership tenure, no sale months.
    const deceased = await createMember({ totalContribution: 30 });
    const report = await reportMemberDeath(deceased.id, deceasedInput, deathCertificate, COMMITTEE_USER, null);
    expect(report.eligibility.isEligible).toBe(false);

    await expect(approveFuneralCase(report.funeralCaseId, {}, MUNICIPALITY_USER)).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(await statusOf(deceased.id)).toBe('active');
    const funeralCase = await prisma.funeralCase.findUniqueOrThrow({ where: { id: report.funeralCaseId } });
    expect(funeralCase.status).toBe('pending');
  });

  it('pays out only the member\'s own savings and charges nobody else', async () => {
    const fund = await createFundAccount(1000);
    const deceased = await createMember({ totalContribution: 30 });
    const other = await createMember({ totalContribution: 80, withUserAccount: true });

    const result = await reportAndApprove(deceased.id, deceasedInput, { ownSavingsOnly: true });

    expect(await statusOf(deceased.id)).toBe('deceased');
    expect(result.ownSavingsOnly).toBe(true);
    expect(result.deduction.memberCount).toBe(0);
    expect(result.deduction.totalDeducted).toBe(0);
    expect(result.deduction.deceasedOwnSavings).toBe(30);
    expect(result.deduction.totalPayout).toBe(30);

    const funeralCase = await prisma.funeralCase.findUniqueOrThrow({
      where: { id: result.funeralCaseId },
    });
    expect(funeralCase.requiredAmount).toBe(0);
    expect(funeralCase.status).toBe('approved');
    expect(await prisma.funeralContribution.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);

    expect(await savingsOf(other.id)).toBe(80);
    expect(await savingsOf(deceased.id)).toBe(0);

    const account = await prisma.fundAccount.findUniqueOrThrow({ where: { id: fund.id } });
    expect(account.balance).toBe(1000 - 30);
  });

  it('refuses an own-savings-only approval for a member who does meet the conditions', async () => {
    await createFundAccount(1000);
    const deceased = await createMember({ totalContribution: 100 });
    await makeMemberFuneralEligible(deceased.id);
    const other = await createMember({ totalContribution: 80 });

    await expect(
      reportAndApprove(deceased.id, deceasedInput, { ownSavingsOnly: true }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await savingsOf(other.id)).toBe(80);
    expect(await statusOf(deceased.id)).toBe('active');
  });
});
