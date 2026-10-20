import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { chargeFuneralContribution, funeralShortfallMessage } from '../src/services/funeralFundService.js';
import { FUND_TRANSACTION_TYPE, FUNERAL_CONTRIBUTION_STATUS } from '../src/config/constants.js';
import { createFundAccount, createFuneralCase, createMember } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function chargeFor(savings: number, recordedBy = 1) {
  const payer = await createMember({ totalContribution: savings });
  const deceasedPlaceholder = await createMember();
  const funeralCase = await createFuneralCase(deceasedPlaceholder.id);
  const result = await chargeFuneralContribution({
    funeralCaseId: funeralCase.id,
    memberId: payer.id,
    requiredAmount: 50,
    recordedBy,
  });
  const balance = await prisma.memberFundBalance.findUniqueOrThrow({ where: { memberId: payer.id } });
  return { payer, funeralCase, result, savingsAfter: balance.totalContribution };
}

describe('funeralFundService.chargeFuneralContribution', () => {
  it('takes the full 50 baht out of savings that hold at least that much', async () => {
    await createFundAccount(1000);

    const { result, savingsAfter } = await chargeFor(120);

    expect(result.alreadyProcessed).toBe(false);
    expect(result.contribution.fundAmount).toBe(50);
    expect(result.contribution.personalFundAmount).toBe(0);
    expect(result.contribution.totalPaid).toBe(50);
    expect(result.contribution.shortfall).toBe(0);
    expect(result.contribution.status).toBe(FUNERAL_CONTRIBUTION_STATUS.COMPLETED);
    expect(result.contribution.personalFundBalanceAfter).toBe(70);
    expect(savingsAfter).toBe(70);
  });

  it('takes whatever is there when savings fall short, and records the rest as a shortfall', async () => {
    await createFundAccount(1000);

    const { result, savingsAfter } = await chargeFor(18);

    expect(result.contribution.fundAmount).toBe(18);
    expect(result.contribution.totalPaid).toBe(18);
    expect(result.contribution.shortfall).toBe(32);
    expect(result.contribution.status).toBe(FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID);
    expect(result.contribution.personalFundBalanceAfter).toBe(0);
    expect(savingsAfter).toBe(0);
  });

  it('deducts nothing and reports the full shortfall when savings are empty', async () => {
    await createFundAccount(1000);

    const { payer, funeralCase, result, savingsAfter } = await chargeFor(0);

    expect(result.contribution.totalPaid).toBe(0);
    expect(result.contribution.shortfall).toBe(50);
    expect(result.contribution.status).toBe(FUNERAL_CONTRIBUTION_STATUS.SHORTFALL_REMAINING);
    expect(savingsAfter).toBe(0);

    // No money moved -> no fund_transaction rows, fund account untouched.
    const transactions = await prisma.fundTransaction.findMany({
      where: { funeralCaseId: funeralCase.id, memberId: payer.id },
    });
    expect(transactions).toHaveLength(0);
    const fundAccount = await prisma.fundAccount.findFirst();
    expect(fundAccount?.balance).toBe(1000);
  });

  it('never charges the same member twice for the same death event (duplicate deduction prevention)', async () => {
    await createFundAccount(1000);
    const payer = await createMember({ totalContribution: 50 });
    const deceasedPlaceholder = await createMember();
    const funeralCase = await createFuneralCase(deceasedPlaceholder.id);

    const first = await chargeFuneralContribution({
      funeralCaseId: funeralCase.id,
      memberId: payer.id,
      requiredAmount: 50,
      recordedBy: 1,
    });
    expect(first.alreadyProcessed).toBe(false);

    const second = await chargeFuneralContribution({
      funeralCaseId: funeralCase.id,
      memberId: payer.id,
      requiredAmount: 50,
      recordedBy: 1,
    });
    expect(second.alreadyProcessed).toBe(true);
    expect(second.contribution.id).toBe(first.contribution.id);

    const rows = await prisma.funeralContribution.findMany({
      where: { funeralCaseId: funeralCase.id, memberId: payer.id },
    });
    expect(rows).toHaveLength(1);

    // Balance only reflects the first (and only) deduction.
    const balance = await prisma.memberFundBalance.findUnique({ where: { memberId: payer.id } });
    expect(balance?.totalContribution).toBe(0);
  });

  it('writes one benefit_payment row referencing the death event and debits the fund account', async () => {
    const fundAccount = await createFundAccount(1000);

    const { payer, funeralCase } = await chargeFor(30, 7);

    const transactions = await prisma.fundTransaction.findMany({
      where: { funeralCaseId: funeralCase.id, memberId: payer.id },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.transactionType).toBe(FUND_TRANSACTION_TYPE.BENEFIT_PAYMENT);
    expect(transactions[0]?.amountOut).toBe(30);
    expect(transactions[0]?.recordedBy).toBe(7);

    const updatedFundAccount = await prisma.fundAccount.findUnique({ where: { id: fundAccount.id } });
    expect(updatedFundAccount?.balance).toBe(970);
  });
});

describe('funeralShortfallMessage', () => {
  it('states the remaining shortfall amount (shortfall notification wording)', () => {
    expect(funeralShortfallMessage(25)).toContain('25');
  });
});
