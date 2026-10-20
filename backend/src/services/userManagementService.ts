import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

export async function listUsers() {
  const users = await prisma.userAccount.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      phone: true,
      role: {
        select: {
          id: true,
          roleName: true,
        },
      },
      member: {
        select: {
          memberCode: true
        }
      },
      status: true,
      lastLogin: true,
      avatarUrl: true,
    },
    orderBy: {
      id: 'desc',
    },
  });
  return users;
}

const userListSelect = {
  id: true,
  username: true,
  fullName: true,
  phone: true,
  role: { select: { id: true, roleName: true } },
  member: { select: { memberCode: true } },
  status: true,
  lastLogin: true,
  avatarUrl: true,
} satisfies Prisma.UserAccountSelect;

export interface UserListQuery {
  page: number;
  pageSize: number;
  // Username / full name (any case) or phone (contains).
  search?: string | undefined;
  roleId?: number | undefined;
  status?: string | undefined;
}

// One page of the account list, filtered by the database. The summary counts
// every account regardless of the filters, for the cards above the table.
export async function listUsersPage(query: UserListQuery) {
  const search = query.search;
  const where: Prisma.UserAccountWhereInput = {
    ...(query.roleId ? { roleId: query.roleId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, items, allCount, activeCount, inactiveCount] = await Promise.all([
    prisma.userAccount.count({ where }),
    prisma.userAccount.findMany({
      where,
      select: userListSelect,
      orderBy: { id: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.userAccount.count(),
    prisma.userAccount.count({ where: { status: 'active' } }),
    prisma.userAccount.count({ where: { status: 'inactive' } }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
    summary: { total: allCount, active: activeCount, inactive: inactiveCount },
  };
}

// Committee accounts carry a village assignment, so they are created and
// re-assigned only through /admin/committees (adminCommitteeService). Letting
// this generic screen mint one would produce a committee with no village, which
// is refused at every committee endpoint anyway.
const COMMITTEE_MANAGED_ELSEWHERE =
  'บัญชีกรรมการหมู่บ้านต้องจัดการจากหน้า "กรรมการหมู่บ้าน" เพื่อระบุหมู่บ้านที่รับผิดชอบ';

async function isCommitteeRole(roleId: number) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { roleName: true } });
  return role?.roleName === 'committee';
}

export async function createUser(data: { username: string; password: string; fullName: string; phone?: string; roleId: number }) {
  if (await isCommitteeRole(data.roleId)) {
    throw ApiError.badRequest(COMMITTEE_MANAGED_ELSEWHERE);
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.userAccount.create({
      data: {
        username: data.username,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone,
        roleId: data.roleId,
      },
      include: {
        role: {
          select: {
            id: true,
            roleName: true,
          }
        }
      }
    });
    // Remove passwordHash before returning
    const { passwordHash: _hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw ApiError.conflict('Username already exists');
      }
    }
    throw error;
  }
}

export async function updateUser(id: number, data: { fullName?: string; phone?: string; roleId?: number; password?: string }) {
  const existingUser = await prisma.userAccount.findUnique({ where: { id } });
  if (!existingUser) {
    throw ApiError.notFound('User not found');
  }

  // Editing an existing committee's name/phone/password here is fine; promoting
  // some other account into the committee role is not (no village to bind).
  if (
    data.roleId !== undefined &&
    data.roleId !== existingUser.roleId &&
    (await isCommitteeRole(data.roleId))
  ) {
    throw ApiError.badRequest(COMMITTEE_MANAGED_ELSEWHERE);
  }

  const updateData: any = {
    fullName: data.fullName,
    phone: data.phone,
    roleId: data.roleId,
  };

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const updatedUser = await prisma.userAccount.update({
    where: { id },
    data: updateData,
    include: {
      role: {
        select: {
          id: true,
          roleName: true,
        }
      }
    }
  });

  const { passwordHash: _hash, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
}

export async function toggleUserStatus(id: number) {
  const existingUser = await prisma.userAccount.findUnique({ where: { id } });
  if (!existingUser) {
    throw ApiError.notFound('User not found');
  }

  const newStatus = existingUser.status === 'active' ? 'inactive' : 'active';
  const updatedUser = await prisma.userAccount.update({
    where: { id },
    data: { status: newStatus },
    include: {
      role: {
        select: {
          id: true,
          roleName: true,
        }
      }
    }
  });

  const { passwordHash: _hash, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
}

export async function adminResetPassword(id: number) {
  const existingUser = await prisma.userAccount.findUnique({ where: { id } });
  if (!existingUser) {
    throw ApiError.notFound('User not found');
  }

  const tempPassword = 'Temp' + Math.floor(100000 + Math.random() * 900000);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.userAccount.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
    }
  });

  return { tempPassword };
}
