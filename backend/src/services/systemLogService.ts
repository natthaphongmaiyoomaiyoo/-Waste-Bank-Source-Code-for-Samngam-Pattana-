import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';

interface LogActionPayload {
  userId?: number | null;
  actionType: string;
  module: string;
  action: string;
  detail?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: string;
}

export const logAction = async (payload: LogActionPayload) => {
  try {
    const result = await prisma.systemLog.create({
      data: {
        userId: payload.userId,
        actionType: payload.actionType,
        module: payload.module,
        action: payload.action,
        detail: payload.detail,
        targetId: payload.targetId,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        status: payload.status || 'success',
      },
    });
    return result;
  } catch (error) {
    console.error('Failed to log system action:', error);
    // We typically don't throw here to avoid failing the main transaction if logging fails
  }
};

export const getSystemLogs = async () => {
  try {
    const logs = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500, // Limit to recent logs to avoid massive payloads
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            role: {
              select: {
                roleName: true,
              },
            },
          },
        },
      },
    });
    return logs;
  } catch (error) {
    console.error('Failed to fetch system logs:', error);
    throw error;
  }
};

export interface SystemLogListQuery {
  page: number;
  pageSize: number;
  // Username, detail, action or module (contains, any case).
  search?: string | undefined;
  actionType?: string | undefined;
  // Newest first unless false.
  descending?: boolean | undefined;
}

// One page of the log, filtered by the database - unlike getSystemLogs, a
// search reaches every row, not just the latest 500.
export const listSystemLogs = async (query: SystemLogListQuery) => {
  const search = query.search;
  const where: Prisma.SystemLogWhereInput = {
    ...(query.actionType
      ? { actionType: { equals: query.actionType, mode: 'insensitive' } }
      : {}),
    ...(search
      ? {
          OR: [
            { user: { username: { contains: search, mode: 'insensitive' } } },
            { detail: { contains: search, mode: 'insensitive' } },
            { action: { contains: search, mode: 'insensitive' } },
            { module: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.systemLog.count({ where }),
    prisma.systemLog.findMany({
      where,
      orderBy: [{ createdAt: query.descending === false ? 'asc' : 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            role: { select: { roleName: true } },
          },
        },
      },
    }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
  };
};
