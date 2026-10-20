import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { privateFileUrl } from './storageService.js';
import type { MemberHistoryQuery } from '../validators/sellRequestValidators.js';

const saleListInclude = {
  details: { include: { wasteType: true } },
  receipt: true,
  round: true,
} as const;

export async function listSales(memberId: number) {
  return prisma.wasteSale.findMany({
    where: { memberId, status: 'completed' },
    include: saleListInclude,
    orderBy: { saleDate: 'desc' },
  });
}

// One page of the member's sale history ("ขายขยะ" tab), newest first by
// default. 'amount' sorts on the sale's gross totalAmount.
export async function listSalesPage(memberId: number, query: MemberHistoryQuery & { page: number }) {
  const where = { memberId, status: 'completed' };
  const direction = query.descending === false ? 'asc' : 'desc';
  const [total, items] = await Promise.all([
    prisma.wasteSale.count({ where }),
    prisma.wasteSale.findMany({
      where,
      include: saleListInclude,
      orderBy:
        query.sortBy === 'amount'
          ? [{ totalAmount: direction }, { saleDate: 'desc' }, { id: 'desc' }]
          : [{ saleDate: direction }, { id: direction }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
  };
}

// One of the member's own sales in full, including the bill photos/files the
// committee attached when recording it. Files live in a private bucket, so each
// gets a short-lived signed fileUrl; another member's sale is simply not found.
export async function getSale(memberId: number, saleId: number) {
  const sale = await prisma.wasteSale.findFirst({
    where: { id: saleId, memberId, status: 'completed' },
    include: {
      details: { include: { wasteType: true }, orderBy: { id: 'asc' } },
      receipt: true,
      round: true,
      documents: {
        select: { id: true, originalName: true, mimeType: true, storagePath: true, uploadedAt: true },
        orderBy: { uploadedAt: 'asc' },
      },
    },
  });

  if (!sale) {
    throw ApiError.notFound('Sale not found');
  }

  const documents = await Promise.all(
    sale.documents.map(async ({ storagePath, ...document }) => ({
      ...document,
      fileUrl: await privateFileUrl('saleDocuments', storagePath),
    })),
  );

  return { ...sale, documents };
}
