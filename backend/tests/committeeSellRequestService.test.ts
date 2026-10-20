import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import {
  addSaleDocument,
  confirmRequest,
  getRequestDetail,
  recordPurchase,
} from '../src/services/committeeSellRequestService.js';
import { create as createSellRequest } from '../src/services/sellRequestService.js';
import { createFundAccount, createMember, createVillageArea } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// The weigh-in is recorded against a request the committee has actually taken:
// 'requested' -> (รับเรื่อง) -> 'confirmed' -> (บันทึกรับซื้อ) -> 'completed'.

let memberId: number;
let roundId: number;
let wasteTypeId: number;

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

beforeEach(async () => {
  await resetDb();
  await createFundAccount();

  const village = await createVillageArea('บ้านหนองน้ำ', '1');
  const member = await createMember({ villageAreaId: village.id, moo: '1' });
  memberId = member.id;

  const buyer = await prisma.buyer.create({ data: { buyerName: 'ร้านทดสอบ' } });
  wasteTypeId = (
    await prisma.wasteType.create({
      data: { wasteName: 'ขวดพลาสติก', unit: 'kg', defaultPrice: 8 },
    })
  ).id;
  roundId = (
    await prisma.collectionRound.create({
      data: {
        roundDate: new Date(tomorrow()),
        startTime: '09:00',
        endTime: '12:00',
        buyerId: buyer.id,
        villageAreaId: village.id,
      },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function newRequest() {
  return createSellRequest(memberId, {
    roundId,
    items: [{ wasteTypeId, estimatedQuantity: 5 }],
  });
}

// Only the fields the services read off a multer upload. Typed off the service
// signature so the global Express.Multer namespace isn't needed here.
type UploadedFile = NonNullable<Parameters<typeof addSaleDocument>[2]>;

function fakeProof(name = 'ตาชั่ง.jpg'): UploadedFile {
  return {
    filename: `1755000000000-${name}`,
    originalname: name,
    mimetype: 'image/jpeg',
    size: 184_320,
    buffer: Buffer.from('test-proof'),
  } as UploadedFile;
}

// 5 kg x 8 baht = a 40-baht sale.
const purchaseInput = (depositAmount = 0) => ({ items: [{ wasteTypeId, quantity: 5 }], depositAmount });

async function confirmedRequest() {
  const request = await newRequest();
  await confirmRequest(request.id);
  return request;
}

async function setSavings(amount: number) {
  await prisma.memberFundBalance.update({ where: { memberId }, data: { totalContribution: amount } });
}

async function savingsOf() {
  return (await prisma.memberFundBalance.findUniqueOrThrow({ where: { memberId } })).totalContribution;
}

describe('committeeSellRequestService.recordPurchase', () => {
  it('refuses to record a purchase before the request has been accepted', async () => {
    const request = await newRequest();
    expect(request.status).toBe('requested');

    await expect(
      recordPurchase(request.id, purchaseInput(), 1, [fakeProof()]),
    ).rejects.toMatchObject({ statusCode: 400 });

    // Still untouched - no sale, no status change.
    const after = await prisma.saleRequest.findUnique({
      where: { id: request.id },
      include: { sale: true },
    });
    expect(after?.status).toBe('requested');
    expect(after?.sale).toBeNull();
  });

  // Proof is mandatory: a sale hands cash to a member, so it must never exist
  // without its receipt/photo.
  it('refuses to record a purchase with no proof attached', async () => {
    const request = await newRequest();
    await confirmRequest(request.id);

    await expect(recordPurchase(request.id, purchaseInput(), 1, [])).rejects.toMatchObject({
      statusCode: 400,
    });

    const after = await prisma.saleRequest.findUnique({
      where: { id: request.id },
      include: { sale: true },
    });
    expect(after?.status).toBe('confirmed');
    expect(after?.sale).toBeNull();
  });

  it('records the purchase with its proof in one go', async () => {
    const request = await newRequest();
    await confirmRequest(request.id);

    const result = await recordPurchase(request.id, purchaseInput(), 1, [
      fakeProof('receipt.jpg'),
      fakeProof('scale.jpg'),
    ]);

    expect(result.status).toBe('completed');
    expect(result.sale?.totalAmount).toBe(40);

    const detail = await getRequestDetail(request.id);
    expect(detail.sale?.documents).toHaveLength(2);
    expect(detail.sale?.documents[0]?.fileUrl).toContain('/api/files/sale-documents/');
  });
});

describe('committeeSellRequestService.recordPurchase - savings', () => {
  it('puts the whole sale into savings while they are still under the 50-baht minimum', async () => {
    const request = await confirmedRequest();

    const result = await recordPurchase(request.id, purchaseInput(), 1, [fakeProof()]);

    expect(result.sale?.fundDeductAmount).toBe(40);
    expect(result.sale?.netAmount).toBe(0);
    expect(await savingsOf()).toBe(40);
    const receipt = await prisma.receipt.findUniqueOrThrow({ where: { saleId: result.sale!.id } });
    expect(receipt.paidAmount).toBe(0);
  });

  it('tops savings up to 50 first, then keeps only the amount the member chose', async () => {
    await setSavings(30);
    const request = await confirmedRequest();

    // 40 baht: 20 tops savings up to 50, of the other 20 the member keeps 15.
    const result = await recordPurchase(request.id, purchaseInput(15), 1, [fakeProof()]);

    expect(result.sale?.fundDeductAmount).toBe(20);
    expect(result.sale?.netAmount).toBe(20);
    expect(result.savingsDeposit).toBe(15);
    expect(await savingsOf()).toBe(65);

    const receipt = await prisma.receipt.findUniqueOrThrow({ where: { saleId: result.sale!.id } });
    expect(receipt.paidAmount).toBe(5);

    const ledger = await prisma.fundTransaction.findMany({
      where: { saleId: result.sale!.id },
      orderBy: { id: 'asc' },
    });
    expect(ledger.map((row) => [row.transactionType, row.amountIn])).toEqual([
      ['contribution', 20],
      ['deposit', 15],
    ]);
  });

  it('refuses to keep more than what is left after the top-up, recording nothing', async () => {
    await setSavings(30);
    const request = await confirmedRequest();

    await expect(
      recordPurchase(request.id, purchaseInput(25), 1, [fakeProof()]),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await savingsOf()).toBe(30);
    const after = await prisma.saleRequest.findUnique({
      where: { id: request.id },
      include: { sale: true },
    });
    expect(after?.status).toBe('confirmed');
    expect(after?.sale).toBeNull();
  });
});

describe('committeeSellRequestService.addSaleDocument', () => {
  it('refuses extra proof before a purchase has been recorded', async () => {
    const request = await newRequest();

    await expect(addSaleDocument(request.id, undefined, fakeProof(), 1)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('appends more proof to an existing sale', async () => {
    const request = await newRequest();
    await confirmRequest(request.id);
    await recordPurchase(request.id, purchaseInput(), 1, [fakeProof('receipt.jpg')]);

    const document = await addSaleDocument(request.id, 'ภาพตาชั่งหน้างาน', fakeProof(), 1);
    expect(document.storagePath).toBe(document.fileName);

    const detail = await getRequestDetail(request.id);
    expect(detail.sale?.documents).toHaveLength(2);
    expect(detail.sale?.documents[1]?.note).toBe('ภาพตาชั่งหน้างาน');
  });
});
