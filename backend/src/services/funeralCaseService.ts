import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { monthsSince } from '../utils/age.js';
import {
  FUND_MINIMUM_BAHT,
  FUND_TRANSACTION_TYPE,
  FUNERAL_CASE_STATUS,
  FUNERAL_CONTRIBUTION_STATUS,
  MEMBER_STATUS,
  USER_ACCOUNT_STATUS,
} from '../config/constants.js';
import {
  activeMonthKeysInWindow,
  eligibilityWindowStart,
  evaluateEligibility,
  longestRecentStreak,
} from './eligibilityService.js';
import { collectFuneralContributions, funeralShortfallMessage } from './funeralFundService.js';
import { deleteStoredObject, memberDocumentFolder, storeUpload } from './storageService.js';
import { assertMemberInScope } from './villageScopeService.js';
import type { VillageScope } from '../middleware/villageScope.js';
import type { CommitteeMarkDeceasedInput } from '../validators/committeeValidators.js';

// A member's death goes through two steps:
// 1. reportMemberDeath - the village committee reports it with the death
//    certificate. Only a pending funeral_case is created; the member stays
//    active and no money moves.
// 2. approveFuneralCase - a municipality officer approves it. Only then does
//    the member become deceased, every active member is charged the funeral
//    contribution (or nobody, when the member misses the funeral conditions),
//    and the member's own savings are closed out to the heirs.

function fullNameOf(prefix: string | null | undefined, firstName: string, lastName: string) {
  return `${prefix ?? ''}${firstName} ${lastName}`.trim();
}

function appendRemark(existing: string | null, entry: string) {
  return existing ? `${existing} | ${entry}` : entry;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

// Same decision rule as eligibilityService.checkMemberEligibility (fund /
// membership tenure / active sale months in the rolling window). Takes a client
// so the approval transaction's gate sees its own uncommitted state.
export async function getFuneralEligibility(tx: Prisma.TransactionClient, memberId: number) {
  const now = new Date();
  const [balance, sales, member] = await Promise.all([
    tx.memberFundBalance.findUnique({ where: { memberId } }),
    tx.wasteSale.findMany({
      where: { memberId, status: 'completed', saleDate: { gte: eligibilityWindowStart(now) } },
      select: { saleDate: true },
    }),
    tx.member.findUnique({ where: { id: memberId }, select: { approvedDate: true } }),
  ]);

  const activeKeys = activeMonthKeysInWindow(
    sales.map((sale) => sale.saleDate),
    now,
  );
  const fundBalance = balance?.totalContribution ?? 0;
  const membershipMonths = member?.approvedDate ? monthsSince(member.approvedDate, now) : 0;

  const evaluation = evaluateEligibility({
    fundBalance,
    membershipMonths,
    activeMonths: activeKeys.size,
  });

  return {
    fundBalance,
    membershipMonths,
    activeMonthCount: activeKeys.size,
    // Recorded for reference only - no longer gates eligibility (months don't
    // need to be consecutive).
    continuousMonthCount: longestRecentStreak([...activeKeys]),
    isEligible: evaluation.eligible,
    reason: evaluation.reason.length ? evaluation.reason.join('; ') : 'ผ่านเงื่อนไขครบถ้วน',
    // Each unmet condition on its own, for the approval screen's list.
    unmetConditions: evaluation.reason,
  };
}

// Who is charged when a death is approved: every other active member, except
// those who are themselves reported dead and still waiting for approval -
// their savings stay for their own heirs.
function payerWhere(deceasedMemberId: number): Prisma.MemberWhereInput {
  return {
    id: { not: deceasedMemberId },
    status: MEMBER_STATUS.ACTIVE,
    funeralCases: { none: { status: FUNERAL_CASE_STATUS.PENDING } },
  };
}

export async function reportMemberDeath(
  memberId: number,
  input: CommitteeMarkDeceasedInput,
  file: Express.Multer.File,
  recordedBy: number,
  scope: VillageScope | null,
) {
  // Only the deceased member has to belong to the committee's village - the
  // funeral fund itself is municipality-wide, so on approval every active
  // member across all villages contributes.
  await assertMemberInScope(memberId, scope);

  const { note } = input;
  const objectPath = await storeUpload('memberDocuments', file, memberDocumentFolder('death_certificate'));

  try {
    return await prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({
        where: { id: memberId },
        select: { status: true },
      });
      if (!member) {
        throw ApiError.notFound('Member not found');
      }
      if (member.status === MEMBER_STATUS.DECEASED) {
        throw ApiError.badRequest('Member is already marked as deceased');
      }
      if (member.status === MEMBER_STATUS.RESIGNED) {
        throw ApiError.badRequest('Resigned members cannot be marked as deceased from this workflow');
      }
      const pending = await tx.funeralCase.findFirst({
        where: { deceasedMemberId: memberId, status: FUNERAL_CASE_STATUS.PENDING },
        select: { id: true },
      });
      if (pending) {
        throw ApiError.badRequest('สมาชิกรายนี้ถูกแจ้งเสียชีวิตแล้ว รอเจ้าหน้าที่เทศบาลอนุมัติ');
      }

      const funeralCase = await tx.funeralCase.create({
        data: {
          deceasedMemberId: memberId,
          eventDate: new Date(),
          deathDate: new Date(input.deathDate),
          causeOfDeath: input.causeOfDeath,
          recordedBy,
          reportNote: note ?? null,
          status: FUNERAL_CASE_STATUS.PENDING,
        },
      });

      await tx.memberDocument.create({
        data: {
          memberId,
          documentType: 'death_certificate',
          fileName: objectPath,
          originalName: file.originalname,
          storagePath: objectPath,
          mimeType: file.mimetype,
          fileSize: file.size,
          note,
          uploadedBy: recordedBy,
        },
      });

      return {
        funeralCaseId: funeralCase.id,
        status: funeralCase.status,
        // As it stands today, for the committee's information - the decision
        // is taken again at approval, when money actually moves.
        eligibility: await getFuneralEligibility(tx, memberId),
      };
    });
  } catch (error) {
    await deleteStoredObject('memberDocuments', objectPath).catch(() => undefined);
    throw error;
  }
}

// What approving a pending case would do right now, for the municipality's
// approval screen. approveFuneralCase evaluates it again inside its transaction.
export async function previewFuneralApproval(deceasedMemberId: number) {
  const [eligibility, payerCount] = await Promise.all([
    getFuneralEligibility(prisma, deceasedMemberId),
    prisma.member.count({ where: payerWhere(deceasedMemberId) }),
  ]);
  const ownSavingsOnly = !eligibility.isEligible;
  return {
    eligibility,
    ownSavingsOnly,
    amountPerMember: ownSavingsOnly ? 0 : FUND_MINIMUM_BAHT,
    payerCount: ownSavingsOnly ? 0 : payerCount,
    deceasedOwnSavings: roundMoney(Math.max(eligibility.fundBalance, 0)),
  };
}

export async function approveFuneralCase(
  funeralCaseId: number,
  input: { ownSavingsOnly?: boolean | undefined },
  approvedBy: number,
) {
  return prisma.$transaction(async (tx) => {
    const funeralCase = await tx.funeralCase.findUnique({
      where: { id: funeralCaseId },
      include: { deceasedMember: { include: { userAccount: { select: { id: true } } } } },
    });
    if (!funeralCase) {
      throw ApiError.notFound('Funeral case not found');
    }
    if (funeralCase.status !== FUNERAL_CASE_STATUS.PENDING) {
      throw ApiError.badRequest('การแจ้งเสียชีวิตนี้อนุมัติไปแล้ว');
    }
    const member = funeralCase.deceasedMember;
    const memberId = member.id;
    if (member.status === MEMBER_STATUS.DECEASED) {
      throw ApiError.badRequest('Member is already marked as deceased');
    }
    if (member.status === MEMBER_STATUS.RESIGNED) {
      throw ApiError.badRequest('สมาชิกรายนี้ลาออกไปแล้ว จึงอนุมัติการเสียชีวิตไม่ได้');
    }

    // A member who doesn't meet the funeral-fund conditions is still approved,
    // but nobody is charged for them: the heirs get only the member's own
    // savings (closed out below). The officer must have confirmed exactly that
    // case - charging every member can't be undone, so a screen that is out of
    // date in either direction is refused rather than guessed at.
    const eligibility = await getFuneralEligibility(tx, memberId);
    if (!eligibility.isEligible && !input.ownSavingsOnly) {
      throw ApiError.badRequest(
        `สมาชิกยังไม่ผ่านเงื่อนไขฌาปนกิจ: ${eligibility.reason} - ต้องยืนยันว่าทายาทจะได้รับเฉพาะเงินสะสมของสมาชิกเอง`,
      );
    }
    if (eligibility.isEligible && input.ownSavingsOnly) {
      throw ApiError.badRequest('สมาชิกผ่านเงื่อนไขฌาปนกิจแล้ว กรุณาโหลดหน้าใหม่แล้วอนุมัติอีกครั้ง');
    }
    const ownSavingsOnly = !eligibility.isEligible;
    // Nobody is charged for an own-savings-only case.
    const requiredAmount = ownSavingsOnly ? 0 : FUND_MINIMUM_BAHT;

    // Claim the case before any money moves: the row lock makes a second
    // approval racing this one wait, then find it no longer pending.
    const claimed = await tx.funeralCase.updateMany({
      where: { id: funeralCaseId, status: FUNERAL_CASE_STATUS.PENDING },
      data: {
        status: FUNERAL_CASE_STATUS.APPROVED,
        approvedBy,
        approvedAt: new Date(),
        requiredAmount,
      },
    });
    if (claimed.count === 0) {
      throw ApiError.conflict('การแจ้งเสียชีวิตนี้อนุมัติไปแล้ว');
    }

    const note = funeralCase.reportNote;
    const deceasedName = fullNameOf(member.prefix, member.firstName, member.lastName);
    const deathRemark = [
      'แจ้งเสียชีวิต',
      ownSavingsOnly ? ' (ไม่ผ่านเงื่อนไขฌาปนกิจ ได้รับเฉพาะเงินสะสมของตนเอง)' : '',
      note ? `: ${note}` : '',
    ].join('');

    // No payers for an own-savings-only case: the charge and the payer
    // notifications below all run on none.
    const payers = ownSavingsOnly
      ? []
      : await tx.member.findMany({
          where: payerWhere(memberId),
          select: {
            id: true,
            userAccount: { select: { id: true } },
            // Read with the payer list so the batch charge below needs no lookup
            // of its own.
            fundBalance: { select: { totalContribution: true } },
          },
          orderBy: { memberCode: 'asc' },
        });

    await tx.member.update({
      where: { id: memberId },
      data: {
        status: MEMBER_STATUS.DECEASED,
        remark: appendRemark(member.remark, deathRemark),
        ...(member.userAccount ? { userAccount: { update: { status: USER_ACCOUNT_STATUS.INACTIVE } } } : {}),
      },
    });
    await tx.memberStatusHistory.create({
      data: {
        memberId,
        fromStatus: member.status,
        toStatus: MEMBER_STATUS.DECEASED,
        reason: note ? `เทศบาลอนุมัติการแจ้งเสียชีวิต: ${note}` : 'เทศบาลอนุมัติการแจ้งเสียชีวิต',
        changedBy: approvedBy,
      },
    });

    const fundAccount =
      (await tx.fundAccount.findFirst()) ??
      (await tx.fundAccount.create({ data: { accountName: 'กองทุนฌาปนกิจสงเคราะห์', balance: 0 } }));

    // Each payer is charged independently: up to `requiredAmount` comes out of
    // their savings balance (member_fund_balance.total_contribution). A payer
    // without enough savings doesn't block the whole death event - they end up
    // partially paid / shortfall-remaining instead, and get notified individually.
    // Every payer is charged in one batch, so the query count stays fixed however
    // large the membership grows.
    const batch = await collectFuneralContributions(tx, {
      funeralCaseId,
      payers: payers.map((payer) => ({
        memberId: payer.id,
        savings: payer.fundBalance?.totalContribution ?? 0,
      })),
      requiredAmount,
      recordedBy: approvedBy,
      fundAccountId: fundAccount.id,
      fundAccountBalance: fundAccount.balance,
      fundNote: `หักเงินสะสมเข้ากองทุนฌาปนกิจ กรณีสมาชิก ${member.memberCode} ${deceasedName} เสียชีวิต`,
    });
    let runningBalance = batch.fundAccountBalanceAfter;
    const contributions = payers.map((payer, index) => {
      const charge = batch.charges[index]!;
      return {
        userId: payer.userAccount?.id,
        totalPaid: charge.fundAmount,
        shortfall: charge.shortfall,
        status: charge.status,
      };
    });

    // เงินสะสมของผู้เสียชีวิตเองถูกปิดบัญชีทั้งจำนวน แล้วรวมเป็นเงินที่ทายาทได้รับ
    // ด้วย (สมาชิกที่ตายไม่ได้ถูกเรียกเก็บ 50 บาทเหมือนคนอื่น แต่เงินที่สะสมไว้
    // ทั้งหมดตกเป็นของกองทุนฌาปนกิจสำหรับงานของตัวเอง)
    const deceasedBalance = await tx.memberFundBalance.findUnique({ where: { memberId } });
    const deceasedOwnSavings = roundMoney(Math.max(deceasedBalance?.totalContribution ?? 0, 0));
    if (deceasedOwnSavings > 0) {
      await tx.memberFundBalance.update({
        where: { memberId },
        data: { totalContribution: 0 },
      });
      runningBalance = roundMoney(runningBalance - deceasedOwnSavings);
      await tx.fundTransaction.create({
        data: {
          fundAccountId: fundAccount.id,
          memberId,
          funeralCaseId,
          transactionType: FUND_TRANSACTION_TYPE.BENEFIT_PAYMENT,
          amountOut: deceasedOwnSavings,
          balanceAfter: runningBalance,
          recordedBy: approvedBy,
          note: `ปิดบัญชีเงินสะสมของสมาชิก ${member.memberCode} ${deceasedName} เข้ากองทุนฌาปนกิจ`,
        },
      });
    }

    await tx.fundAccount.update({
      where: { id: fundAccount.id },
      data: { balance: runningBalance },
    });

    // The wording of these two is parsed by the member's NotificationBell popup
    // (parseFuneralNotice) - keep them in step.
    const notificationRecipients = contributions.filter(
      (contribution): contribution is typeof contribution & { userId: number } =>
        typeof contribution.userId === 'number',
    );
    if (notificationRecipients.length > 0) {
      await tx.notification.createMany({
        data: notificationRecipients.map((contribution) => ({
          userId: contribution.userId,
          title: 'แจ้งสมาชิกเสียชีวิตและหักเงินสะสม',
          message:
            contribution.shortfall > 0
              ? `สมาชิก ${deceasedName} เสียชีวิต อัตราเงินฌาปนกิจ ${requiredAmount.toLocaleString()} บาท ระบบหักจากเงินสะสมได้ ${contribution.totalPaid.toLocaleString()} บาท และยังขาด ${contribution.shortfall.toLocaleString()} บาท`
              : `สมาชิก ${deceasedName} เสียชีวิต ระบบหักเงินฌาปนกิจจากเงินสะสมของท่าน ${contribution.totalPaid.toLocaleString()} บาทแล้ว`,
          notificationType: 'funeral',
        })),
      });
    }

    const shortfallRecipients = contributions.filter((c) => c.shortfall > 0 && typeof c.userId === 'number');
    if (shortfallRecipients.length > 0) {
      await tx.notification.createMany({
        data: shortfallRecipients.map((c) => ({
          userId: c.userId!,
          title: 'เงินสะสมไม่พอหักเงินฌาปนกิจ',
          message: funeralShortfallMessage(c.shortfall),
          notificationType: 'fund',
        })),
      });
    }

    const totalDeducted = roundMoney(contributions.reduce((sum, c) => sum + c.totalPaid, 0));
    return {
      funeralCaseId,
      eligibility,
      ownSavingsOnly,
      deduction: {
        amountPerMember: requiredAmount,
        memberCount: payers.length,
        // memberCount = ถูกเรียกเก็บกี่คน, paidMemberCount = หักเงินได้จริงกี่คน
        // (คนที่เงินสะสมเป็น 0 ถูกเรียกเก็บแต่จ่ายไม่ได้)
        paidMemberCount: contributions.filter((c) => c.totalPaid > 0).length,
        totalDeducted,
        // เงินสะสมของผู้เสียชีวิตที่ปิดบัญชีเข้ามา และยอดรวมที่ทายาทได้รับจริง
        deceasedOwnSavings,
        totalPayout: roundMoney(totalDeducted + deceasedOwnSavings),
        fundBalanceAfter: runningBalance,
        completedCount: contributions.filter((c) => c.status === FUNERAL_CONTRIBUTION_STATUS.COMPLETED).length,
        partiallyPaidCount: contributions.filter((c) => c.status === FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID)
          .length,
        shortfallRemainingCount: contributions.filter(
          (c) => c.status === FUNERAL_CONTRIBUTION_STATUS.SHORTFALL_REMAINING,
        ).length,
      },
    };
    // The payers are charged in one batch, but the transaction still makes a
    // dozen-plus sequential round trips to the hosted database, which Prisma's
    // 5 s default can miss on a slow link.
  }, { maxWait: 10_000, timeout: 120_000 });
}
