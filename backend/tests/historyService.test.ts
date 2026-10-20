import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { getSale } from '../src/services/historyService.js';
import { createMember } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// The member's sale-detail dialog: every weighed line, the total, and the bill
// photos the committee attached - but only ever for the member's own sale.

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createSaleWithProof(memberId: number) {
  const buyer = await prisma.buyer.create({ data: { buyerName: 'ร้านทดสอบ' } });
  const round = await prisma.collectionRound.create({
    data: { roundDate: new Date(), startTime: '09:00', endTime: '12:00', buyerId: buyer.id, status: 'completed' },
  });
  const bottles = await prisma.wasteType.create({ data: { wasteName: 'ขวดพลาสติก PET', unit: 'kg', defaultPrice: 8 } });
  const boxes = await prisma.wasteType.create({ data: { wasteName: 'กระดาษลัง', unit: 'kg', defaultPrice: 3 } });
  return prisma.wasteSale.create({
    data: {
      saleNo: `SL-HIST-${memberId}`,
      memberId,
      roundId: round.id,
      buyerId: buyer.id,
      totalAmount: 49,
      fundDeductAmount: 49,
      netAmount: 0,
      details: {
        create: [
          { wasteTypeId: bottles.id, quantity: 5, unitPrice: 8, subtotal: 40 },
          { wasteTypeId: boxes.id, quantity: 3, unitPrice: 3, subtotal: 9 },
        ],
      },
      documents: {
        create: {
          fileName: 'sale-documents/bill.jpg',
          originalName: 'bill.jpg',
          storagePath: 'sale-documents/bill.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
        },
      },
    },
  });
}

describe('historyService.getSale', () => {
  it('returns every line of the member\'s own sale plus a viewable link for each bill', async () => {
    const member = await createMember();
    const sale = await createSaleWithProof(member.id);

    const detail = await getSale(member.id, sale.id);

    expect(detail.totalAmount).toBe(49);
    expect(detail.details.map((line) => [line.wasteType.wasteName, line.quantity, line.unitPrice, line.subtotal])).toEqual([
      ['ขวดพลาสติก PET', 5, 8, 40],
      ['กระดาษลัง', 3, 3, 9],
    ]);
    expect(detail.documents).toHaveLength(1);
    expect(detail.documents[0]).toMatchObject({ originalName: 'bill.jpg', mimeType: 'image/jpeg' });
    expect(detail.documents[0]!.fileUrl).toContain('bill.jpg');
    // The raw storage path stays on the server; the client only gets the link.
    expect(detail.documents[0]).not.toHaveProperty('storagePath');
  });

  it("refuses another member's sale", async () => {
    const owner = await createMember();
    const other = await createMember();
    const sale = await createSaleWithProof(owner.id);

    await expect(getSale(other.id, sale.id)).rejects.toMatchObject({ statusCode: 404 });
  });
});
