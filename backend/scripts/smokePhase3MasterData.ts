import assert from 'node:assert/strict';
import { prisma } from '../src/database/prisma.js';
import * as masterData from '../src/services/adminMasterDataService.js';

const listQuery = { page: 1, pageSize: 50 };

async function main() {
  const buyer = await masterData.createBuyer({
    buyerName: 'Phase 3 Smoke Buyer',
    contactName: 'Smoke Tester',
    phone: '0800000000',
    address: 'Smoke address',
    status: 'active',
  });
  assert.equal(buyer.status, 'active');

  const updatedBuyer = await masterData.updateBuyer(buyer.id, {
    buyerName: 'Phase 3 Smoke Buyer Updated',
    contactName: 'Smoke Tester',
    phone: '0800000001',
    address: 'Smoke address updated',
    status: 'active',
  });
  assert.equal(updatedBuyer.phone, '0800000001');

  await masterData.deactivateBuyer(buyer.id);
  const inactiveBuyer = await prisma.buyer.findUniqueOrThrow({ where: { id: buyer.id } });
  assert.equal(inactiveBuyer.status, 'inactive');

  const village = await masterData.createVillageArea({
    villageName: 'Phase 3 Smoke Village',
    moo: '99',
    subdistrict: 'สามง่ามพัฒนา',
    district: 'หันคา',
    province: 'ชัยนาท',
    postcode: '17130',
    status: 'active',
  });
  assert.equal(village.status, 'active');

  await masterData.deactivateVillageArea(village.id);
  const inactiveVillage = await prisma.villageArea.findUniqueOrThrow({ where: { id: village.id } });
  assert.equal(inactiveVillage.status, 'inactive');

  const fund = await masterData.createFundAccount({
    accountName: 'Phase 3 Smoke Fund',
    balance: 100,
  });
  const updatedFund = await masterData.updateFundAccount(fund.id, {
    accountName: 'Phase 3 Smoke Fund Updated',
    balance: 250,
  });
  assert.equal(updatedFund.balance, 250);

  const roles = await masterData.listRoles();
  assert.deepEqual(
    roles.map((role) => role.roleName).sort(),
    ['admin', 'buyer', 'committee', 'member', 'municipality'],
  );

  const setting = await masterData.upsertSystemSetting(
    {
      settingKey: 'phase3.smoke',
      settingValue: 'true',
      valueType: 'boolean',
      description: 'Phase 3 smoke test setting',
    },
    1,
  );
  assert.equal(setting.settingValue, 'true');
  await masterData.deleteSystemSetting(setting.id);
  const deletedSetting = await prisma.systemSetting.findUnique({ where: { id: setting.id } });
  assert.equal(deletedSetting, null);

  const wasteType = await prisma.wasteType.findFirstOrThrow({ orderBy: { id: 'asc' } });
  const openBefore = await prisma.wastePriceHistory.findFirst({
    where: { wasteTypeId: wasteType.id, buyerId: null, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });
  assert.ok(openBefore);

  const price = await masterData.createWastePriceHistory(
    {
      wasteTypeId: wasteType.id,
      price: 19.75,
      effectiveFrom: '2026-08-01T00:00:00.000Z',
    },
    1,
  );
  assert.equal(price.price, 19.75);

  const refreshedWasteType = await prisma.wasteType.findUniqueOrThrow({ where: { id: wasteType.id } });
  assert.equal(refreshedWasteType.defaultPrice, 19.75);

  const priceHistory = await masterData.listWastePriceHistories({
    ...listQuery,
    wasteTypeId: wasteType.id,
  });
  assert.ok(priceHistory.total >= 2);

  const buyers = await masterData.listBuyers(listQuery);
  const villages = await masterData.listVillageAreas(listQuery);
  const funds = await masterData.listFundAccounts(listQuery);
  const settings = await masterData.listSystemSettings(listQuery);
  assert.ok(buyers.total >= 2);
  assert.ok(villages.total >= 4);
  assert.ok(funds.total >= 2);
  assert.ok(settings.total >= 3);

  console.log('Phase 3 master-data smoke test passed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
