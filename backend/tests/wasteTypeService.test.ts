import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import {
  approveProposal,
  listActive,
  listOwnProposals,
  listProposals,
  propose,
  rejectProposal,
} from '../src/services/wasteTypeService.js';
import { resetDb } from './helpers/resetDb.js';

let buyerUserId: number;
let adminUserId: number;

async function createAccount(roleName: string, username: string) {
  const role = await prisma.role.upsert({
    where: { roleName },
    update: {},
    create: { roleName, description: roleName },
  });

  return prisma.userAccount.create({
    data: {
      username,
      passwordHash: 'x',
      fullName: `Test ${roleName}`,
      roleId: role.id,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  buyerUserId = (await createAccount('buyer', 'test-buyer')).id;
  adminUserId = (await createAccount('admin', 'test-admin')).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('wasteTypeService buyer proposals', () => {
  it('keeps a proposed type out of the catalog until an admin approves it', async () => {
    const proposal = await propose(buyerUserId, {
      wasteName: 'ขวดแก้วใส',
      unit: 'kg',
      defaultPrice: 3.5,
    });

    expect(proposal.status).toBe('pending');
    expect(proposal.proposedBy).toBe(buyerUserId);
    // Nothing members/committees read may show it yet, and no price history is
    // written before approval.
    expect(await listActive()).toEqual([]);
    expect(await prisma.wastePriceHistory.count()).toBe(0);

    const approved = await approveProposal(proposal.id, adminUserId, {});

    expect(approved.status).toBe('active');
    expect(approved.reviewedBy).toBe(adminUserId);
    expect((await listActive()).map((row) => row.wasteName)).toEqual(['ขวดแก้วใส']);

    const history = await prisma.wastePriceHistory.findMany({ where: { wasteTypeId: proposal.id } });
    expect(history).toHaveLength(1);
    expect(history[0]!.price).toBe(3.5);
  });

  it('lets the admin correct the suggested price while approving', async () => {
    const proposal = await propose(buyerUserId, {
      wasteName: 'กระดาษลัง',
      unit: 'kg',
      defaultPrice: 9,
    });

    const approved = await approveProposal(proposal.id, adminUserId, { defaultPrice: 6.25 });

    expect(approved.defaultPrice).toBe(6.25);
    const history = await prisma.wastePriceHistory.findMany({ where: { wasteTypeId: proposal.id } });
    expect(history[0]!.price).toBe(6.25);
  });

  it('keeps a rejected proposal (with its reason) visible to the buyer but out of the catalog', async () => {
    const proposal = await propose(buyerUserId, {
      wasteName: 'เศษอาหาร',
      unit: 'kg',
      defaultPrice: 1,
    });

    await rejectProposal(proposal.id, adminUserId, { reason: 'ไม่ใช่ขยะรีไซเคิล' });

    expect(await listActive()).toEqual([]);

    const own = await listOwnProposals(buyerUserId);
    expect(own).toHaveLength(1);
    expect(own[0]!.status).toBe('rejected');
    expect(own[0]!.rejectReason).toBe('ไม่ใช่ขยะรีไซเคิล');
  });

  it('refuses a duplicate of an existing or already-pending type', async () => {
    await propose(buyerUserId, { wasteName: 'อลูมิเนียม', unit: 'kg', defaultPrice: 40 });

    await expect(
      propose(buyerUserId, { wasteName: 'อลูมิเนียม', unit: 'kg', defaultPrice: 45 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects a second review of a proposal that was already decided', async () => {
    const proposal = await propose(buyerUserId, {
      wasteName: 'เหล็ก',
      unit: 'kg',
      defaultPrice: 12,
    });
    await approveProposal(proposal.id, adminUserId, {});

    await expect(approveProposal(proposal.id, adminUserId, {})).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('notifies admins on submit and the buyer on the decision', async () => {
    const proposal = await propose(buyerUserId, {
      wasteName: 'ทองแดง',
      unit: 'kg',
      defaultPrice: 200,
    });

    const adminNotifications = await prisma.notification.findMany({ where: { userId: adminUserId } });
    expect(adminNotifications).toHaveLength(1);
    expect(adminNotifications[0]!.notificationType).toBe('waste_type');

    await approveProposal(proposal.id, adminUserId, {});

    const buyerNotifications = await prisma.notification.findMany({ where: { userId: buyerUserId } });
    expect(buyerNotifications).toHaveLength(1);
    expect(buyerNotifications[0]!.title).toBe('อนุมัติประเภทขยะแล้ว');
  });

  it('shows admins only pending proposals by default, with the proposer attached', async () => {
    const pending = await propose(buyerUserId, {
      wasteName: 'พลาสติกขุ่น',
      unit: 'kg',
      defaultPrice: 5,
    });
    const decided = await propose(buyerUserId, {
      wasteName: 'ขวด PET',
      unit: 'kg',
      defaultPrice: 11,
    });
    await approveProposal(decided.id, adminUserId, {});

    const queue = await listProposals('pending');
    expect(queue.map((row) => row.id)).toEqual([pending.id]);
    expect(queue[0]!.proposer?.fullName).toBe('Test buyer');

    expect((await listProposals('all')).map((row) => row.id).sort()).toEqual(
      [pending.id, decided.id].sort(),
    );
  });
});
