import { prisma } from '../../src/database/prisma.js';

// Wipes every table these tests touch, in FK-safe (children-first) order.
// `role` is left alone - it's shared reference data, upserted once by
// fixtures.ts and reused across tests.
export async function resetDb() {
  await prisma.notification.deleteMany();
  // Before sale_request + buyer, both of which route stops/plans reference.
  await prisma.pickupRouteStop.deleteMany();
  await prisma.pickupRoutePlan.deleteMany();
  await prisma.fundTransaction.deleteMany();
  await prisma.funeralContribution.deleteMany();
  await prisma.funeralCase.deleteMany();
  await prisma.memberFundBalance.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.eligibilityCheck.deleteMany();
  await prisma.memberStatusHistory.deleteMany();
  await prisma.memberDocument.deleteMany();
  await prisma.memberVerification.deleteMany();
  await prisma.memberGuarantor.deleteMany();
  await prisma.saleRequestItem.deleteMany();
  await prisma.saleRequest.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.saleDocument.deleteMany();
  await prisma.wasteSaleDetail.deleteMany();
  await prisma.wasteSale.deleteMany();
  await prisma.member.deleteMany();
  await prisma.household.deleteMany();
  // After household + userAccount, both of which reference it.
  await prisma.villageArea.deleteMany();
  await prisma.fundAccount.deleteMany();
  await prisma.collectionRound.deleteMany();
  // Before waste_type + buyer, both of which it references.
  await prisma.wastePriceHistory.deleteMany();
  await prisma.wasteType.deleteMany();
  await prisma.buyer.deleteMany();
}
