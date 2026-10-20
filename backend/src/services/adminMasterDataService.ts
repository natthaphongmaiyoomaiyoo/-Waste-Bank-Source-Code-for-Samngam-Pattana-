import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type {
  BuyerInput,
  FundAccountInput,
  MasterListQuery,
  SystemSettingInput,
  VillageAreaInput,
  WastePriceHistoryInput,
} from '../validators/adminMasterDataValidators.js';

function pagination(query: MasterListQuery) {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

function paginated<T>(items: T[], total: number, query: MasterListQuery) {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

// The order a table asked for, when it names one of `columns`; the list's own
// order still breaks ties (and is used alone when no known column was asked).
function orderFor<T>(
  query: MasterListQuery,
  columns: Record<string, (direction: Prisma.SortOrder) => T>,
  fallback: T[],
): T[] {
  const column = query.sortBy ? columns[query.sortBy] : undefined;
  return column ? [column(query.descending ? 'desc' : 'asc'), ...fallback] : fallback;
}

function clean<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ''),
  ) as T;
}

export async function listBuyers(query: MasterListQuery) {
  const where: Prisma.BuyerWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { buyerName: { contains: query.search } },
            { contactName: { contains: query.search } },
            { phone: { contains: query.search } },
            { address: { contains: query.search } },
          ],
        }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.buyer.count({ where }),
    prisma.buyer.findMany({
      where,
      orderBy: orderFor<Prisma.BuyerOrderByWithRelationInput>(
        query,
        { buyerName: (direction) => ({ buyerName: direction }) },
        [{ id: 'asc' }],
      ),
      ...pagination(query),
    }),
  ]);
  return paginated(items, total, query);
}

export async function createBuyer(input: BuyerInput) {
  return prisma.buyer.create({ data: { ...clean(input), status: input.status ?? 'active' } });
}

export async function updateBuyer(id: number, input: BuyerInput) {
  const existing = await prisma.buyer.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Buyer not found');
  return prisma.buyer.update({ where: { id }, data: clean(input) });
}

export async function deactivateBuyer(id: number) {
  const existing = await prisma.buyer.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Buyer not found');
  await prisma.buyer.update({ where: { id }, data: { status: 'inactive' } });
}

export async function listVillageAreas(query: MasterListQuery) {
  const where: Prisma.VillageAreaWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { villageName: { contains: query.search } },
            { moo: { contains: query.search } },
            { subdistrict: { contains: query.search } },
            { district: { contains: query.search } },
            { province: { contains: query.search } },
            { postcode: { contains: query.search } },
          ],
        }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.villageArea.count({ where }),
    prisma.villageArea.findMany({
      where,
      orderBy: orderFor<Prisma.VillageAreaOrderByWithRelationInput>(
        query,
        {
          villageName: (direction) => ({ villageName: direction }),
          moo: (direction) => ({ moo: direction }),
        },
        [{ moo: 'asc' }, { villageName: 'asc' }],
      ),
      ...pagination(query),
    }),
  ]);
  return paginated(items, total, query);
}

// Two active villages sharing a moo makes the address -> village lookup used
// when an admin registers a member ambiguous (villageScopeService
// .resolveAddressVillage), so reject the duplicate up front. Enforced here
// rather than as a DB unique index because legacy rows may already collide.
async function assertMooNotTaken(moo: string | undefined, exceptId?: number) {
  const trimmed = moo?.trim();
  if (!trimmed) return;

  const clash = await prisma.villageArea.findFirst({
    where: {
      moo: trimmed,
      status: 'active',
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { villageName: true },
  });
  if (clash) {
    throw ApiError.conflict(`หมู่ ${trimmed} ถูกใช้โดยหมู่บ้าน "${clash.villageName}" แล้ว`);
  }
}

function normalizeVillageInput(input: VillageAreaInput) {
  const cleaned = clean(input) as VillageAreaInput;
  return { ...cleaned, ...(cleaned.moo ? { moo: cleaned.moo.trim() } : {}) };
}

export async function createVillageArea(input: VillageAreaInput) {
  const data = normalizeVillageInput(input);
  await assertMooNotTaken(data.moo);

  const created = await prisma.villageArea.create({
    data: { ...data, status: input.status ?? 'active' },
  });

  // Adopt households that were registered under this moo before the village
  // existed (or before this fix). Only unlinked ones - never steal a household
  // that already belongs to another village.
  if (created.moo?.trim()) {
    await prisma.household.updateMany({
      where: { villageAreaId: null, moo: created.moo.trim() },
      data: { villageAreaId: created.id },
    });
  }

  return created;
}

export async function updateVillageArea(id: number, input: VillageAreaInput) {
  const existing = await prisma.villageArea.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Village area not found');

  const data = normalizeVillageInput(input);
  await assertMooNotTaken(data.moo, id);

  const updated = await prisma.villageArea.update({ where: { id }, data });

  // Renaming the moo no longer affects permissions (those follow the FK), but
  // the households in this village carry the moo as address text - keep it in
  // step so the member list doesn't show a moo the village no longer uses.
  if (data.moo && data.moo !== existing.moo) {
    await prisma.household.updateMany({
      where: { villageAreaId: id },
      data: { moo: data.moo },
    });
  }

  return updated;
}

export async function deactivateVillageArea(id: number) {
  const existing = await prisma.villageArea.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Village area not found');
  await prisma.villageArea.update({ where: { id }, data: { status: 'inactive' } });
}

export async function listFundAccounts(query: MasterListQuery) {
  const where: Prisma.FundAccountWhereInput = query.search
    ? { accountName: { contains: query.search } }
    : {};
  const [total, items] = await Promise.all([
    prisma.fundAccount.count({ where }),
    prisma.fundAccount.findMany({
      where,
      orderBy: orderFor<Prisma.FundAccountOrderByWithRelationInput>(
        query,
        {
          accountName: (direction) => ({ accountName: direction }),
          balance: (direction) => ({ balance: direction }),
        },
        [{ id: 'asc' }],
      ),
      ...pagination(query),
    }),
  ]);
  return paginated(items, total, query);
}

export async function createFundAccount(input: FundAccountInput) {
  const existing = await prisma.fundAccount.findFirst({ where: { accountName: input.accountName } });
  if (existing) throw ApiError.conflict('Fund account name already exists');
  return prisma.fundAccount.create({
    data: { accountName: input.accountName, balance: input.balance ?? 0 },
  });
}

export async function updateFundAccount(id: number, input: FundAccountInput) {
  const existing = await prisma.fundAccount.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Fund account not found');
  if (input.accountName && input.accountName !== existing.accountName) {
    const dup = await prisma.fundAccount.findFirst({ where: { accountName: input.accountName } });
    if (dup) throw ApiError.conflict('Fund account name already exists');
  }
  return prisma.fundAccount.update({ where: { id }, data: clean(input) });
}

export async function listRoles() {
  return prisma.role.findMany({ orderBy: { id: 'asc' } });
}

export async function createRole(input: { roleName: string; description?: string }) {
  const existing = await prisma.role.findUnique({ where: { roleName: input.roleName } });
  if (existing) throw ApiError.conflict('Role name already exists');
  return prisma.role.create({
    data: {
      roleName: input.roleName,
      description: input.description ?? null,
    },
  });
}

export async function updateRole(id: number, input: { roleName?: string; description?: string }) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Role not found');
  if (input.roleName && input.roleName !== existing.roleName) {
    const dup = await prisma.role.findUnique({ where: { roleName: input.roleName } });
    if (dup) throw ApiError.conflict('Role name already exists');
  }
  return prisma.role.update({
    where: { id },
    data: clean(input as Record<string, unknown>),
  });
}

export async function deleteRole(id: number) {
  const existing = await prisma.role.findUnique({ where: { id }, include: { userAccounts: { take: 1 } } });
  if (!existing) throw ApiError.notFound('Role not found');
  if (existing.userAccounts.length > 0) {
    throw ApiError.badRequest('Cannot delete role that is assigned to users');
  }
  await prisma.role.delete({ where: { id } });
}

export async function listSystemSettings(query: MasterListQuery) {
  const where: Prisma.SystemSettingWhereInput = query.search
    ? {
        OR: [
          { settingKey: { contains: query.search } },
          { settingValue: { contains: query.search } },
          { description: { contains: query.search } },
        ],
      }
    : {};
  const [total, items] = await Promise.all([
    prisma.systemSetting.count({ where }),
    prisma.systemSetting.findMany({
      where,
      orderBy: orderFor<Prisma.SystemSettingOrderByWithRelationInput>(
        query,
        { settingKey: (direction) => ({ settingKey: direction }) },
        [{ settingKey: 'asc' }],
      ),
      ...pagination(query),
    }),
  ]);
  return paginated(items, total, query);
}

export async function upsertSystemSetting(input: SystemSettingInput, updatedBy?: number) {
  return prisma.systemSetting.upsert({
    where: { settingKey: input.settingKey },
    create: { ...input, updatedBy },
    update: {
      settingValue: input.settingValue,
      valueType: input.valueType,
      description: input.description,
      updatedBy,
    },
  });
}

export async function deleteSystemSetting(id: number) {
  const existing = await prisma.systemSetting.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('System setting not found');
  await prisma.systemSetting.delete({ where: { id } });
}

export async function listWastePriceHistories(query: MasterListQuery & { wasteTypeId?: number; buyerId?: number }) {
  const where: Prisma.WastePriceHistoryWhereInput = {
    ...(query.wasteTypeId ? { wasteTypeId: query.wasteTypeId } : {}),
    ...(query.buyerId ? { buyerId: query.buyerId } : {}),
    ...(query.search
      ? {
          OR: [
            { wasteType: { wasteName: { contains: query.search } } },
            { buyer: { buyerName: { contains: query.search } } },
          ],
        }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.wastePriceHistory.count({ where }),
    prisma.wastePriceHistory.findMany({
      where,
      include: { wasteType: true, buyer: true },
      orderBy: orderFor<Prisma.WastePriceHistoryOrderByWithRelationInput>(
        query,
        {
          wasteType: (direction) => ({ wasteType: { wasteName: direction } }),
          price: (direction) => ({ price: direction }),
          effectiveFrom: (direction) => ({ effectiveFrom: direction }),
        },
        [{ effectiveFrom: 'desc' }, { id: 'desc' }],
      ),
      ...pagination(query),
    }),
  ]);
  return paginated(items, total, query);
}

export async function createWastePriceHistory(input: WastePriceHistoryInput, createdBy?: number) {
  const effectiveFrom = new Date(input.effectiveFrom);
  const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw ApiError.badRequest('effectiveTo must be after effectiveFrom');
  }

  return prisma.$transaction(async (tx) => {
    const wasteType = await tx.wasteType.findUnique({ where: { id: input.wasteTypeId } });
    if (!wasteType) throw ApiError.notFound('Waste type not found');

    if (input.buyerId) {
      const buyer = await tx.buyer.findUnique({ where: { id: input.buyerId } });
      if (!buyer) throw ApiError.notFound('Buyer not found');
    }

    await tx.wastePriceHistory.updateMany({
      where: {
        wasteTypeId: input.wasteTypeId,
        buyerId: input.buyerId ?? null,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFrom },
      },
      data: { effectiveTo: effectiveFrom },
    });

    const created = await tx.wastePriceHistory.create({
      data: {
        wasteTypeId: input.wasteTypeId,
        buyerId: input.buyerId,
        price: input.price,
        effectiveFrom,
        effectiveTo,
        createdBy,
      },
      include: { wasteType: true, buyer: true },
    });

    if (!input.buyerId) {
      await tx.wasteType.update({
        where: { id: input.wasteTypeId },
        data: { defaultPrice: input.price },
      });
    }



    return created;
  });
}

// --- Member Types ---

export async function listMemberTypes() {
  return prisma.memberType.findMany({
    orderBy: { id: 'asc' },
  });
}

export async function createMemberType(input: { name: string; description?: string; isActive?: boolean }) {
  try {
    return await prisma.memberType.create({
      data: {
        name: input.name,
        description: input.description ?? '',
        isActive: input.isActive ?? true,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw ApiError.conflict('Member type name already exists');
    }
    throw e;
  }
}

export async function updateMemberType(id: number, input: { name?: string; description?: string; isActive?: boolean }) {
  const existing = await prisma.memberType.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Member type not found');
  try {
    return await prisma.memberType.update({ where: { id }, data: clean(input as Record<string, unknown>) });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw ApiError.conflict('Member type name already exists');
    }
    throw e;
  }
}

export async function deleteMemberType(id: number) {
  const existing = await prisma.memberType.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Member type not found');
  await prisma.memberType.delete({ where: { id } });
}
