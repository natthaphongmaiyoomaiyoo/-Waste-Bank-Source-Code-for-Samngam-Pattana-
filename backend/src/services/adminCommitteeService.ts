import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { USER_ACCOUNT_STATUS } from '../config/constants.js';
import type {
  AdminCommitteeCreateInput,
  AdminCommitteeListQuery,
  AdminCommitteeUpdateInput,
} from '../validators/adminCommitteeValidators.js';

// Admin management of village-committee accounts. One committee account is
// bound to one village_area row (the master data the admin maintains first);
// that binding is what committeeService/villageScopeService use to keep each
// committee inside its own village.

const SALT_ROUNDS = 10;

const committeeSelect = {
  id: true,
  username: true,
  fullName: true,
  phone: true,
  status: true,
  lastLogin: true,
  mustChangePassword: true,
  avatarUrl: true,
  role: { select: { id: true, roleName: true } },
  villageArea: {
    select: {
      id: true,
      villageName: true,
      moo: true,
      subdistrict: true,
      district: true,
      province: true,
      status: true,
    },
  },
} satisfies Prisma.UserAccountSelect;

async function committeeRoleId(): Promise<number> {
  const role = await prisma.role.findUnique({ where: { roleName: 'committee' } });
  if (!role) {
    throw ApiError.conflict('ยังไม่มีสิทธิ์ (role) "committee" ในระบบ');
  }
  return role.id;
}

// The village must exist and still be active - assigning a committee to a
// village the admin has deactivated would leave them unable to work.
async function assertAssignableVillage(villageAreaId: number) {
  const village = await prisma.villageArea.findUnique({ where: { id: villageAreaId } });
  if (!village) {
    throw ApiError.notFound('ไม่พบหมู่บ้านที่เลือก');
  }
  if (village.status !== 'active') {
    throw ApiError.badRequest('หมู่บ้านที่เลือกถูกระงับการใช้งานอยู่');
  }
  if (!village.moo?.trim()) {
    throw ApiError.badRequest(
      'หมู่บ้านที่เลือกยังไม่ได้ระบุ "หมู่ที่" กรุณาแก้ไขข้อมูลหมู่บ้านก่อนผูกกรรมการ',
    );
  }
  return village;
}

// Guards every by-id action: this endpoint only ever touches committee accounts,
// never an admin/municipality/member account that happens to share an id.
async function findCommitteeAccount(id: number) {
  const account = await prisma.userAccount.findUnique({
    where: { id },
    include: { role: { select: { roleName: true } } },
  });
  if (!account || account.role.roleName !== 'committee') {
    throw ApiError.notFound('ไม่พบบัญชีกรรมการหมู่บ้านนี้');
  }
  return account;
}

export async function listCommittees(query: AdminCommitteeListQuery) {
  const where: Prisma.UserAccountWhereInput = {
    role: { roleName: 'committee' },
    ...(query.status ? { status: query.status } : {}),
    ...(query.villageAreaId ? { villageAreaId: query.villageAreaId } : {}),
    ...(query.search
      ? {
          OR: [
            { username: { contains: query.search } },
            { fullName: { contains: query.search } },
            { phone: { contains: query.search } },
            { villageArea: { villageName: { contains: query.search } } },
            { villageArea: { moo: { contains: query.search } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.userAccount.findMany({ where, select: committeeSelect, orderBy: { id: 'desc' } }),
    prisma.userAccount.count({ where }),
  ]);

  return { items, total };
}

export async function getCommitteeSummary() {
  const where = { role: { roleName: 'committee' } } as const;
  const [total, active, coveredVillages, totalVillages] = await Promise.all([
    prisma.userAccount.count({ where }),
    prisma.userAccount.count({ where: { ...where, status: USER_ACCOUNT_STATUS.ACTIVE } }),
    // "Covered" means an ACTIVE committee on an ACTIVE village - a suspended
    // committee, or one attached to a deactivated village, cannot work, so
    // counting it would tell the admin a village is staffed when it is not.
    // Both sides must match the same filter as totalVillages below.
    prisma.userAccount
      .findMany({
        where: {
          ...where,
          status: USER_ACCOUNT_STATUS.ACTIVE,
          villageArea: { is: { status: 'active' } },
        },
        select: { villageAreaId: true },
        distinct: ['villageAreaId'],
      })
      .then((rows) => rows.length),
    prisma.villageArea.count({ where: { status: 'active' } }),
  ]);

  return {
    total,
    active,
    suspended: total - active,
    villagesWithCommittee: coveredVillages,
    totalVillages,
    villagesWithoutCommittee: Math.max(totalVillages - coveredVillages, 0),
  };
}

// Single account for the edit form (which is its own page, not a dialog).
export async function getCommittee(id: number) {
  await findCommitteeAccount(id);
  return prisma.userAccount.findUniqueOrThrow({ where: { id }, select: committeeSelect });
}

export async function createCommittee(input: AdminCommitteeCreateInput) {
  await assertAssignableVillage(input.villageAreaId);

  const existing = await prisma.userAccount.findUnique({ where: { username: input.username } });
  if (existing) {
    throw ApiError.conflict('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    return await prisma.userAccount.create({
      data: {
        username: input.username,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone ?? null,
        roleId: await committeeRoleId(),
        villageAreaId: input.villageAreaId,
        status: input.status,
      },
      select: committeeSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw ApiError.conflict('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
    }
    throw error;
  }
}

export async function updateCommittee(id: number, input: AdminCommitteeUpdateInput) {
  await findCommitteeAccount(id);

  if (input.villageAreaId !== undefined) {
    await assertAssignableVillage(input.villageAreaId);
  }

  return prisma.userAccount.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.villageAreaId !== undefined ? { villageAreaId: input.villageAreaId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      // The password the admin types here is the committee's actual password -
      // no forced "set a new password" screen on the next login (same rule as
      // committee-created member accounts).
      ...(input.password
        ? {
            passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
            mustChangePassword: false,
            passwordChangedAt: new Date(),
            failedLoginCount: 0,
            lockedUntil: null,
          }
        : {}),
    },
    select: committeeSelect,
  });
}

// Suspend / re-enable. A suspended account is rejected at login (authService)
// and on every authenticated request (requireAuth), same as any other account.
export async function toggleCommitteeStatus(id: number) {
  const account = await findCommitteeAccount(id);
  const status =
    account.status === USER_ACCOUNT_STATUS.ACTIVE
      ? USER_ACCOUNT_STATUS.INACTIVE
      : USER_ACCOUNT_STATUS.ACTIVE;

  return prisma.userAccount.update({ where: { id }, data: { status }, select: committeeSelect });
}

// Hard delete. The account's own notifications go with it; login_audit rows are
// kept (user_id is set to NULL by the FK) so the audit trail survives, and
// system_log stores a plain user id that is intentionally left alone.
export async function deleteCommittee(id: number) {
  await findCommitteeAccount(id);

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.userAccount.delete({ where: { id } });
  });
}
