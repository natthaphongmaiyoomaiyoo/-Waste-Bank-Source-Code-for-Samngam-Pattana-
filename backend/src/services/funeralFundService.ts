import { Prisma, type FuneralContribution } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { FUND_TRANSACTION_TYPE, FUNERAL_CONTRIBUTION_STATUS } from '../config/constants.js';

// Funeral fund collection engine for one death event (funeral_case) and one
// paying member: takes up to `requiredAmount` (50 baht) out of the member's
// savings balance (member_fund_balance.total_contribution). Every member is
// required to keep at least that much, so a balance that falls short is still
// taken as far as it goes and the rest is recorded as the shortfall.
// Every call produces one funeral_contribution row (the audit log), plus a
// fund_transaction row whenever money actually moved. Idempotent per
// (funeralCaseId, memberId): calling it again for a case/member pair that
// already has a row is a no-op that returns the existing row untouched, so a
// member can never be charged twice for the same death event.

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

// The charge rule itself, shared by the single-member and batch paths below:
// up to `requiredAmount` out of whatever savings the member holds.
export function funeralCharge(savingsBalance: number, requiredAmount: number) {
  const savings = Math.max(savingsBalance, 0);
  const fundAmount = roundMoney(Math.min(requiredAmount, savings));
  const shortfall = roundMoney(requiredAmount - fundAmount);
  const status =
    shortfall <= 0
      ? FUNERAL_CONTRIBUTION_STATUS.COMPLETED
      : fundAmount > 0
        ? FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID
        : FUNERAL_CONTRIBUTION_STATUS.SHORTFALL_REMAINING;
  return { fundAmount, shortfall, status, balanceAfter: roundMoney(savings - fundAmount) };
}

function funeralFundNote(fundAmount: number, fundNote?: string) {
  return fundNote ?? `หักเงินสะสมเข้ากองทุนฌาปนกิจ ${fundAmount.toLocaleString()} บาท`;
}

export interface CollectFuneralContributionParams {
  funeralCaseId: number;
  memberId: number;
  requiredAmount: number;
  recordedBy?: number | null;
  fundAccountId: number;
  fundAccountBalance: number;
  fundNote?: string;
}

export interface CollectFuneralContributionResult {
  alreadyProcessed: boolean;
  contribution: FuneralContribution;
  fundAccountBalanceAfter: number;
}

export async function collectFuneralContribution(
  tx: Prisma.TransactionClient,
  params: CollectFuneralContributionParams,
): Promise<CollectFuneralContributionResult> {
  const { funeralCaseId, memberId, requiredAmount, recordedBy, fundAccountId, fundAccountBalance, fundNote } = params;

  const existing = await tx.funeralContribution.findUnique({
    where: { funeralCaseId_memberId: { funeralCaseId, memberId } },
  });
  if (existing) {
    return { alreadyProcessed: true, contribution: existing, fundAccountBalanceAfter: fundAccountBalance };
  }

  const balance = await tx.memberFundBalance.findUnique({ where: { memberId } });
  const { fundAmount, shortfall, status, balanceAfter } = funeralCharge(
    balance?.totalContribution ?? 0,
    requiredAmount,
  );

  if (fundAmount > 0) {
    await tx.memberFundBalance.update({
      where: { memberId },
      data: { totalContribution: { decrement: fundAmount } },
    });
  }

  const contribution = await tx.funeralContribution.create({
    data: {
      funeralCaseId,
      memberId,
      requiredAmount,
      fundAmount,
      personalFundAmount: 0,
      totalPaid: fundAmount,
      shortfall,
      status,
      personalFundBalanceAfter: balanceAfter,
      recordedBy: recordedBy ?? null,
    },
  });

  let fundAccountBalanceAfter = fundAccountBalance;

  if (fundAmount > 0) {
    fundAccountBalanceAfter = roundMoney(fundAccountBalanceAfter - fundAmount);
    await tx.fundTransaction.create({
      data: {
        fundAccountId,
        memberId,
        funeralCaseId,
        transactionType: FUND_TRANSACTION_TYPE.BENEFIT_PAYMENT,
        amountOut: fundAmount,
        balanceAfter: fundAccountBalanceAfter,
        recordedBy: recordedBy ?? null,
        note: funeralFundNote(fundAmount, fundNote),
      },
    });
  }

  return { alreadyProcessed: false, contribution, fundAccountBalanceAfter };
}

export interface FuneralPayer {
  memberId: number;
  // member_fund_balance.total_contribution; 0 for a member without that row.
  savings: number;
}

// Batch twin of collectFuneralContribution for markMemberDeceased, which
// charges every active member at once. Same rule and the same rows, but a
// fixed three writes in total instead of up to five queries per payer. Payers
// are charged in the order given, and the fund account's running balance
// (fund_transaction.balance_after) follows that order.
//
// The case must have been created in this same transaction: nobody can hold a
// contribution row for it yet, so the per-payer "already charged?" lookup is
// skipped. The unique (funeral_case_id, member_id) index still refuses a
// duplicate, which rolls the whole transaction back.
export async function collectFuneralContributions(
  tx: Prisma.TransactionClient,
  params: Omit<CollectFuneralContributionParams, 'memberId'> & { payers: FuneralPayer[] },
) {
  const { funeralCaseId, payers, requiredAmount, recordedBy, fundAccountId, fundNote } = params;

  let fundAccountBalanceAfter = params.fundAccountBalance;
  const charges = payers.map((payer) => {
    const charge = funeralCharge(payer.savings, requiredAmount);
    if (charge.fundAmount > 0) {
      fundAccountBalanceAfter = roundMoney(fundAccountBalanceAfter - charge.fundAmount);
    }
    return { memberId: payer.memberId, ...charge, fundAccountBalanceAfter };
  });

  if (charges.length) {
    await tx.funeralContribution.createMany({
      data: charges.map((charge) => ({
        funeralCaseId,
        memberId: charge.memberId,
        requiredAmount,
        fundAmount: charge.fundAmount,
        personalFundAmount: 0,
        totalPaid: charge.fundAmount,
        shortfall: charge.shortfall,
        status: charge.status,
        personalFundBalanceAfter: charge.balanceAfter,
        recordedBy: recordedBy ?? null,
      })),
    });
  }

  const paid = charges.filter((charge) => charge.fundAmount > 0);
  if (paid.length) {
    await tx.fundTransaction.createMany({
      data: paid.map((charge) => ({
        fundAccountId,
        memberId: charge.memberId,
        funeralCaseId,
        transactionType: FUND_TRANSACTION_TYPE.BENEFIT_PAYMENT,
        amountOut: charge.fundAmount,
        balanceAfter: charge.fundAccountBalanceAfter,
        recordedBy: recordedBy ?? null,
        note: funeralFundNote(charge.fundAmount, fundNote),
      })),
    });

    // Decrements, never overwrites, each balance by exactly what was charged -
    // the same as the single-member path's `decrement`. One statement for all.
    const amounts = Prisma.join(
      paid.map((charge) => Prisma.sql`(${charge.memberId}::int, ${charge.fundAmount}::double precision)`),
    );
    await tx.$executeRaw`
      UPDATE member_fund_balance AS b
      SET total_contribution = b.total_contribution - v.amount,
          updated_at = NOW() AT TIME ZONE 'UTC'
      FROM (VALUES ${amounts}) AS v(member_id, amount)
      WHERE b.member_id = v.member_id`;
  }

  return { charges, fundAccountBalanceAfter };
}

// --- Late payments -------------------------------------------------------------
// A member who could not cover a death's 50 baht can bring the rest in cash
// later. Each payment lowers the shortfall on that one contribution row and the
// money goes on to that death's family, so the case's payout grows with it.

// The outcome of paying `amount` towards one contribution. Partial payments are
// allowed; paying more than is owed is not.
export function latePaymentOutcome(
  current: { totalPaid: number; shortfall: number },
  amount: number,
) {
  const owed = roundMoney(Math.max(current.shortfall, 0));
  const paid = roundMoney(amount);
  if (owed <= 0) {
    throw ApiError.badRequest('รายการนี้จ่ายครบแล้ว');
  }
  if (!(paid > 0)) {
    throw ApiError.badRequest('จำนวนเงินต้องมากกว่า 0');
  }
  if (paid > owed) {
    throw ApiError.badRequest(`ยอดค้างมีเพียง ${owed.toLocaleString()} บาท`);
  }
  const shortfall = roundMoney(owed - paid);
  return {
    amount: paid,
    totalPaid: roundMoney(current.totalPaid + paid),
    shortfall,
    status:
      shortfall <= 0
        ? FUNERAL_CONTRIBUTION_STATUS.COMPLETED
        : FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID,
  };
}

export interface RecordFuneralLatePaymentParams {
  funeralCaseId: number;
  contributionId: number;
  amount: number;
  note?: string | undefined;
  recordedBy: number;
}

// The writes of one late payment, inside the caller's transaction:
// 1. the contribution row: paid up by `amount`, shortfall down, status updated;
// 2. the ledger: the cash in (funeral_late_payment, on the payer) and straight
//    out to the family (benefit_payment, on nobody), so the fund balance - the
//    members' pooled savings - is unchanged. The payout carries no member: on
//    the payer it would read as a cut from their savings (it never touched
//    them), and on the deceased it would count as their own closed-out savings
//    (municipalityService.deceasedOwnSavingsOf);
// 3. a notification to the member who paid.
export async function recordFuneralLatePaymentTx(
  tx: Prisma.TransactionClient,
  params: RecordFuneralLatePaymentParams,
) {
  const { funeralCaseId, contributionId, recordedBy } = params;
  const contribution = await tx.funeralContribution.findUnique({
    where: { id: contributionId },
    include: {
      member: {
        select: { memberCode: true, prefix: true, firstName: true, lastName: true, userAccount: { select: { id: true } } },
      },
      funeralCase: {
        select: {
          deceasedMember: { select: { memberCode: true, prefix: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!contribution || contribution.funeralCaseId !== funeralCaseId) {
    throw ApiError.notFound('Funeral contribution not found');
  }

  const outcome = latePaymentOutcome(contribution, params.amount);

  // Only applies while the shortfall is still what was read above, so two
  // payments recorded at the same moment cannot both pass the "not more than
  // is owed" check.
  const updated = await tx.funeralContribution.updateMany({
    where: { id: contributionId, shortfall: contribution.shortfall },
    data: { totalPaid: outcome.totalPaid, shortfall: outcome.shortfall, status: outcome.status },
  });
  if (updated.count !== 1) {
    throw ApiError.conflict('ยอดค้างเพิ่งถูกเปลี่ยน กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง');
  }

  const fundAccount = await tx.fundAccount.findFirst();
  if (!fundAccount) {
    throw ApiError.conflict('Fund account is not available');
  }
  const nameOf = (p: { prefix: string | null; firstName: string; lastName: string }) =>
    `${p.prefix ?? ''}${p.firstName} ${p.lastName}`.trim();
  const deceased = contribution.funeralCase.deceasedMember;
  const caseLabel = `กรณีสมาชิก ${deceased.memberCode} ${nameOf(deceased)} เสียชีวิต`;
  const extra = params.note ? ` (${params.note})` : '';
  await tx.fundTransaction.createMany({
    data: [
      {
        fundAccountId: fundAccount.id,
        memberId: contribution.memberId,
        funeralCaseId,
        transactionType: FUND_TRANSACTION_TYPE.FUNERAL_LATE_PAYMENT,
        amountIn: outcome.amount,
        balanceAfter: roundMoney(fundAccount.balance + outcome.amount),
        recordedBy,
        note: `รับชำระเงินฌาปนกิจค้างจ่าย (เงินสด) ${caseLabel}${extra}`,
      },
      {
        fundAccountId: fundAccount.id,
        memberId: null,
        funeralCaseId,
        transactionType: FUND_TRANSACTION_TYPE.BENEFIT_PAYMENT,
        amountOut: outcome.amount,
        balanceAfter: fundAccount.balance,
        recordedBy,
        note: `ส่งต่อเงินฌาปนกิจที่รับชำระภายหลังจาก ${contribution.member.memberCode} ${nameOf(contribution.member)} ให้ทายาท ${caseLabel}`,
      },
    ],
  });

  const userId = contribution.member.userAccount?.id;
  if (userId) {
    await tx.notification.create({
      data: {
        userId,
        title: 'รับชำระเงินฌาปนกิจค้างจ่ายแล้ว',
        message:
          outcome.shortfall > 0
            ? `ได้รับเงินฌาปนกิจ ${caseLabel} ${outcome.amount.toLocaleString()} บาท ยังค้างอีก ${outcome.shortfall.toLocaleString()} บาท`
            : `ได้รับเงินฌาปนกิจ ${caseLabel} ${outcome.amount.toLocaleString()} บาท ชำระครบแล้ว`,
        notificationType: 'funeral',
      },
    });
  }

  return {
    contributionId,
    memberId: contribution.memberId,
    memberName: nameOf(contribution.member),
    ...outcome,
  };
}

export async function recordFuneralLatePayment(params: RecordFuneralLatePaymentParams) {
  return prisma.$transaction((tx) => recordFuneralLatePaymentTx(tx, params));
}

export function funeralShortfallMessage(shortfall: number): string {
  return `เงินสะสมของท่านไม่พอหักเงินฌาปนกิจ ยังขาดอีก ${shortfall.toLocaleString()} บาท`;
}

// Standalone entry point (own transaction) for charging a single member for
// an existing funeral case - e.g. from a test, or a future "retry shortfall
// collection" admin action. committeeService.markMemberDeceased instead calls
// collectFuneralContributions directly so every payer in a death event is
// covered by one shared transaction.
export async function chargeFuneralContribution(
  params: Omit<CollectFuneralContributionParams, 'fundAccountId' | 'fundAccountBalance'>,
) {
  return prisma.$transaction(async (tx) => {
    const fundAccount = await tx.fundAccount.findFirst();
    if (!fundAccount) {
      throw ApiError.conflict('Fund account is not available');
    }

    const result = await collectFuneralContribution(tx, {
      ...params,
      fundAccountId: fundAccount.id,
      fundAccountBalance: fundAccount.balance,
    });

    if (!result.alreadyProcessed) {
      await tx.fundAccount.update({
        where: { id: fundAccount.id },
        data: { balance: result.fundAccountBalanceAfter },
      });
    }

    return result;
  });
}
