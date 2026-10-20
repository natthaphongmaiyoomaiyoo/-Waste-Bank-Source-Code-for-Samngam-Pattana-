import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { WASTE_TYPE_STATUS } from '../config/constants.js';
import type {
  CreateWasteTypeInput,
  ProposeWasteTypeInput,
  RejectWasteTypeInput,
  ReviewWasteTypeInput,
  UpdateWasteTypeInput,
} from '../validators/wasteTypeValidators.js';

// Only 'active' rows are ever returned here, so a buyer proposal stays invisible
// to members and committees until an admin approves it.
export async function listActive() {
  return prisma.wasteType.findMany({
    where: { status: WASTE_TYPE_STATUS.ACTIVE },
    orderBy: { id: 'asc' },
  });
}

export async function create(input: CreateWasteTypeInput) {
  return prisma.$transaction(async (tx) => {
    const wasteType = await tx.wasteType.create({
      data: {
        wasteName: input.wasteName,
        unit: input.unit,
        defaultPrice: input.defaultPrice,
        status: WASTE_TYPE_STATUS.ACTIVE,
      },
    });

    await tx.wastePriceHistory.create({
      data: {
        wasteTypeId: wasteType.id,
        price: input.defaultPrice,
        effectiveFrom: new Date(),
      },
    });

    return wasteType;
  });
}

export async function update(id: number, input: UpdateWasteTypeInput) {
  const existing = await prisma.wasteType.findUnique({ where: { id } });
  if (!existing || existing.status !== WASTE_TYPE_STATUS.ACTIVE) {
    throw ApiError.notFound('Waste type not found');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.wasteType.update({
      where: { id },
      data: {
        ...(input.wasteName !== undefined ? { wasteName: input.wasteName } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.defaultPrice !== undefined ? { defaultPrice: input.defaultPrice } : {}),
      },
    });

    if (input.defaultPrice !== undefined && input.defaultPrice !== existing.defaultPrice) {
      const now = new Date();
      await tx.wastePriceHistory.updateMany({
        where: { wasteTypeId: id, buyerId: null, effectiveTo: null },
        data: { effectiveTo: now },
      });
      await tx.wastePriceHistory.create({
        data: {
          wasteTypeId: id,
          price: input.defaultPrice,
          effectiveFrom: now,
        },
      });
    }

    return updated;
  });
}

export async function deactivate(id: number) {
  const existing = await prisma.wasteType.findUnique({ where: { id } });
  if (!existing || existing.status !== WASTE_TYPE_STATUS.ACTIVE) {
    throw ApiError.notFound('Waste type not found');
  }

  await prisma.wasteType.update({
    where: { id },
    data: { status: WASTE_TYPE_STATUS.INACTIVE },
  });
}

// ---------------------------------------------------------------------------
// Buyer proposals -> admin approval
// ---------------------------------------------------------------------------

const REVIEWABLE_STATUSES: string[] = [WASTE_TYPE_STATUS.PENDING];

async function notifyAdmins(title: string, message: string) {
  const admins = await prisma.userAccount.findMany({
    where: { role: { roleName: 'admin' }, status: 'active' },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title,
      message,
      notificationType: 'waste_type',
    })),
  });
}

async function notifyProposer(userId: number | null, title: string, message: string) {
  if (!userId) return;
  const account = await prisma.userAccount.findUnique({ where: { id: userId } });
  if (!account) return;

  await prisma.notification.create({
    data: { userId, title, message, notificationType: 'waste_type' },
  });
}

// A buyer suggesting a new waste type + the price they expect to pay for it.
// Creates the row straight away as 'pending' - no price history is written
// until an admin approves, so nothing leaks into the catalog early.
export async function propose(userId: number, input: ProposeWasteTypeInput) {
  const duplicate = await prisma.wasteType.findFirst({
    where: {
      wasteName: input.wasteName,
      status: { in: [WASTE_TYPE_STATUS.ACTIVE, WASTE_TYPE_STATUS.PENDING] },
    },
  });
  if (duplicate) {
    throw ApiError.conflict(
      duplicate.status === WASTE_TYPE_STATUS.ACTIVE
        ? 'ประเภทขยะนี้มีอยู่ในระบบแล้ว'
        : 'ประเภทขยะนี้ถูกเสนอไว้แล้วและกำลังรอการอนุมัติ',
    );
  }

  const proposal = await prisma.wasteType.create({
    data: {
      wasteName: input.wasteName,
      unit: input.unit,
      defaultPrice: input.defaultPrice,
      status: WASTE_TYPE_STATUS.PENDING,
      proposedBy: userId,
      proposedAt: new Date(),
    },
  });

  await notifyAdmins(
    'มีคำขอเพิ่มประเภทขยะ',
    `ผู้รับซื้อเสนอเพิ่ม "${proposal.wasteName}" ราคาประมาณ ${proposal.defaultPrice} บาท/${proposal.unit}`,
  );

  return proposal;
}

// Everything the proposing buyer submitted, whatever the outcome, so a rejected
// proposal (and its reason) stays visible to them.
export async function listOwnProposals(userId: number) {
  return prisma.wasteType.findMany({
    where: { proposedBy: userId },
    orderBy: { id: 'desc' },
  });
}

// Admin queue. Defaults to the pending ones; `status=all` shows the history of
// everything buyers have ever proposed.
export async function listProposals(status?: string) {
  const rows = await prisma.wasteType.findMany({
    where: {
      proposedBy: { not: null },
      ...(status && status !== 'all' ? { status } : {}),
    },
    orderBy: { id: 'desc' },
  });

  const proposerIds = [...new Set(rows.map((row) => row.proposedBy).filter((id): id is number => id !== null))];
  const proposers = proposerIds.length
    ? await prisma.userAccount.findMany({
        where: { id: { in: proposerIds } },
        select: { id: true, fullName: true, username: true },
      })
    : [];
  const byId = new Map(proposers.map((account) => [account.id, account]));

  return rows.map((row) => ({
    ...row,
    proposer: row.proposedBy ? (byId.get(row.proposedBy) ?? null) : null,
  }));
}

async function findPending(id: number) {
  const proposal = await prisma.wasteType.findUnique({ where: { id } });
  if (!proposal || proposal.proposedBy === null || !REVIEWABLE_STATUSES.includes(proposal.status)) {
    throw ApiError.notFound('Waste type proposal not found');
  }
  return proposal;
}

// Approval is what publishes the type: status flips to 'active' and the opening
// price-history row is written, matching what create() does for admin-added
// types. The admin may correct the buyer's suggested price while approving.
export async function approveProposal(id: number, adminUserId: number, input: ReviewWasteTypeInput) {
  const proposal = await findPending(id);
  const now = new Date();
  const price = input.defaultPrice ?? proposal.defaultPrice;

  const approved = await prisma.$transaction(async (tx) => {
    const updated = await tx.wasteType.update({
      where: { id },
      data: {
        ...(input.wasteName !== undefined ? { wasteName: input.wasteName } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        defaultPrice: price,
        status: WASTE_TYPE_STATUS.ACTIVE,
        reviewedBy: adminUserId,
        reviewedAt: now,
        rejectReason: null,
      },
    });

    await tx.wastePriceHistory.create({
      data: { wasteTypeId: id, price, effectiveFrom: now },
    });

    return updated;
  });

  await notifyProposer(
    proposal.proposedBy,
    'อนุมัติประเภทขยะแล้ว',
    `"${approved.wasteName}" ได้รับการอนุมัติแล้ว ราคา ${approved.defaultPrice} บาท/${approved.unit}`,
  );

  return approved;
}

export async function rejectProposal(id: number, adminUserId: number, input: RejectWasteTypeInput) {
  const proposal = await findPending(id);

  const rejected = await prisma.wasteType.update({
    where: { id },
    data: {
      status: WASTE_TYPE_STATUS.REJECTED,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      rejectReason: input.reason,
    },
  });

  await notifyProposer(
    proposal.proposedBy,
    'ไม่อนุมัติประเภทขยะ',
    `"${rejected.wasteName}" ไม่ได้รับการอนุมัติ: ${input.reason}`,
  );

  return rejected;
}
