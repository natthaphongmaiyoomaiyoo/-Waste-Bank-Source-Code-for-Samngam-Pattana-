import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { localTimeSql, thaiShortDateSql } from '../utils/thaiDateSql.js';
import {
  COLLECTION_ROUND_STATUS,
  MEMBER_STATUS,
  SALE_REQUEST_STATUS,
  SELL_REQUEST_ADVANCE_DAYS,
} from '../config/constants.js';
import type {
  CreateSellRequestInput,
  SellRequestListQuery,
} from '../validators/sellRequestValidators.js';
import { roundWindowEnded, sellRequestWindow } from './scheduleService.js';

const requestInclude = {
  // Buyer names the round on the member's history; its locationNote is shown
  // as the round's note.
  round: { include: { buyer: { select: { buyerName: true } } } },
  items: { include: { wasteType: true } },
};

function isUnreadableAddress(value: string): boolean {
  return /\?{3,}/.test(value);
}

export async function create(memberId: number, input: CreateSellRequestInput) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { household: true },
  });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }
  if (member.status !== MEMBER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Only active members can submit a sell request');
  }

  const round = await prisma.collectionRound.findUnique({ where: { id: input.roundId } });
  const { from: startOfToday, until } = sellRequestWindow();

  if (!round || round.status !== COLLECTION_ROUND_STATUS.PLANNED || round.roundDate < startOfToday) {
    // Members may only pick a date the committee has actually scheduled and opened -
    // never an arbitrary date, and never one that's full/cancelled/past.
    throw ApiError.badRequest('Selected round is not open for sell requests');
  }

  // The round's own time window has to still be running - a round dated today
  // that ran until 17:00 is closed after 17:00.
  if (roundWindowEnded(round)) {
    throw ApiError.badRequest('รอบนี้ปิดรับคำร้องแล้ว (เลยเวลาสิ้นสุดรอบ)');
  }

  // A committee may open a round months ahead; requests for it only open once it
  // is within the advance window (same rule the schedule list is flagged with).
  if (round.roundDate > until) {
    throw ApiError.badRequest(
      `รอบนี้ยังไม่เปิดให้แจ้งขายขยะ แจ้งล่วงหน้าได้ไม่เกิน ${SELL_REQUEST_ADVANCE_DAYS} วันก่อนวันรับซื้อ`,
    );
  }

  // A village round belongs to that village's members only. Checked here and
  // not just hidden from the list, so passing another village's roundId by hand
  // is refused too. (round.villageAreaId === null = municipality-wide round.)
  if (round.villageAreaId !== null && round.villageAreaId !== member.household.villageAreaId) {
    throw ApiError.forbidden('รอบรับซื้อนี้เปิดสำหรับสมาชิกในอีกหมู่บ้านหนึ่ง');
  }

  // One request per member per round. A cancelled one (by the member or the
  // committee) no longer counts, so the member can send a new one for the round.
  const existing = await prisma.saleRequest.findFirst({
    where: {
      memberId,
      roundId: round.id,
      status: { not: SALE_REQUEST_STATUS.CANCELLED },
    },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict(
      'คุณแจ้งขายขยะรอบนี้ไปแล้ว แจ้งได้ 1 ครั้งต่อรอบ หากต้องการแจ้งใหม่ กรุณายกเลิกคำขอเดิมก่อน',
    );
  }

  const wasteTypeIds = input.items.map((item) => item.wasteTypeId);
  if (wasteTypeIds.length > 0) {
    const wasteTypes = await prisma.wasteType.findMany({ where: { id: { in: wasteTypeIds } } });
    if (wasteTypes.length !== new Set(wasteTypeIds).size) {
      throw ApiError.badRequest('One or more wasteTypeId values are invalid');
    }
  }

  const estimatedQuantity = input.items.reduce((sum, item) => sum + item.estimatedQuantity, 0);

  // Default the pickup address from the member's household so the committee
  // list is useful even when the member didn't type one.
  const household = member.household;
  const householdAddress = [
    household.houseNo ? `บ้านเลขที่ ${household.houseNo}` : null,
    household.moo ? `หมู่ ${household.moo}` : null,
    household.subdistrict ? `ต.${household.subdistrict}` : null,
    household.district ? `อ.${household.district}` : null,
    household.province ? `จ.${household.province}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const pickupAddress = input.pickupAddress?.trim();

  const request = await prisma.saleRequest.create({
    data: {
      memberId,
      roundId: input.roundId,
      pickupAddress: pickupAddress && !isUnreadableAddress(pickupAddress) ? pickupAddress : householdAddress || null,
      pickupLat: input.pickupLat ?? null,
      pickupLng: input.pickupLng ?? null,
      estimatedQuantity,
      note: input.note ?? null,
      status: SALE_REQUEST_STATUS.REQUESTED,
      items: {
        create: input.items.map((item) => ({
          wasteTypeId: item.wasteTypeId,
          estimatedQuantity: item.estimatedQuantity,
        })),
      },
    },
    include: requestInclude,
  });

  // Push the new request into every committee account's notification feed so
  // it "arrives" at the committee, not just sits in the member's own list.
  const committeeAccounts = await prisma.userAccount.findMany({
    where: { role: { roleName: 'committee' }, status: 'active' },
    select: { id: true },
  });
  if (committeeAccounts.length > 0) {
    const memberName = `${member.prefix ?? ''}${member.firstName} ${member.lastName}`.trim();
    await prisma.notification.createMany({
      data: committeeAccounts.map((account) => ({
        userId: account.id,
        title: 'มีคำร้องขายขยะใหม่',
        message:
          estimatedQuantity > 0
            ? `${memberName} แจ้งขายขยะประมาณ ${estimatedQuantity} กก. รอการรับเรื่อง`
            : `${memberName} แจ้งขายขยะ รอการรับเรื่อง`,
        notificationType: 'sell_request',
      })),
    });
  }

  return request;
}

export async function list(memberId: number) {
  return prisma.saleRequest.findMany({
    where: { memberId },
    include: requestInclude,
    orderBy: { requestDate: 'desc' },
  });
}

// Status wording as the member's request list shows it, so a search for
// "รับซื้อแล้ว" still finds completed requests once the search runs here.
const REQUEST_STATUS_LABELS: Record<string, string> = {
  requested: 'รอรับเรื่อง',
  confirmed: 'กรรมการกำลังไปรับ',
  completed: 'รับซื้อแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

// Ids of the member's requests whose displayed text contains `search`: the
// buyer (the list's "area"), status and its label, request and round dates
// ("15 ก.ย. 2569"), the member's note, the round's note and times, and the
// waste types - the same text the request list used to search in the browser.
async function requestIdsMatching(memberId: number, search: string): Promise<number[]> {
  const like = `%${search.toLowerCase()}%`;
  const statusLabel = Prisma.sql`CASE sr.status ${Prisma.join(
    Object.entries(REQUEST_STATUS_LABELS).map(
      ([status, label]) => Prisma.sql`WHEN ${status} THEN ${label}`,
    ),
    ' ',
  )} ELSE ${REQUEST_STATUS_LABELS.requested} END`;
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT sr.request_id AS id
    FROM sale_request sr
    JOIN collection_round cr ON cr.round_id = sr.round_id
    JOIN buyer b ON b.buyer_id = cr.buyer_id
    WHERE sr.member_id = ${memberId}
      AND LOWER(concat_ws(' ',
        b.buyer_name,
        sr.status,
        ${statusLabel},
        ${thaiShortDateSql(localTimeSql(Prisma.sql`sr.request_date`))},
        -- The round's calendar day is its UTC date part (see the frontend).
        ${thaiShortDateSql(Prisma.sql`cr.round_date`)},
        sr.note,
        cr.location_note,
        cr.start_time,
        cr.end_time,
        (SELECT string_agg(wt.waste_name, ' ')
           FROM sale_request_item sri
           JOIN waste_type wt ON wt.waste_type_id = sri.waste_type_id
          WHERE sri.request_id = sr.request_id)
      )) LIKE ${like}
  `;
  return rows.map((row) => row.id);
}

// One page of the member's own requests, filtered and sorted by the database.
export async function listPage(memberId: number, query: SellRequestListQuery & { page: number }) {
  const where: Prisma.SaleRequestWhereInput = {
    memberId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { id: { in: await requestIdsMatching(memberId, query.search) } } : {}),
  };
  const direction = query.descending === false ? 'asc' : 'desc';
  const orderBy: Prisma.SaleRequestOrderByWithRelationInput[] =
    query.sortBy === 'quantity'
      ? [{ estimatedQuantity: direction }, { requestDate: 'desc' }]
      : query.sortBy === 'status'
        ? [{ status: direction }, { requestDate: 'desc' }]
        : [{ requestDate: direction }, { id: direction }];

  const [total, items] = await Promise.all([
    prisma.saleRequest.count({ where }),
    prisma.saleRequest.findMany({
      where,
      include: requestInclude,
      orderBy,
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

// How many of the member's requests sit in each status - the request page's
// cards and the notification bell's "pending" count, without the list itself.
export async function summary(memberId: number) {
  const grouped = await prisma.saleRequest.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { memberId },
  });

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of grouped) {
    byStatus[row.status] = row._count._all;
    total += row._count._all;
  }
  return { total, byStatus };
}

export async function cancel(memberId: number, requestId: number) {
  const request = await prisma.saleRequest.findFirst({ where: { id: requestId, memberId } });
  if (!request) {
    throw ApiError.notFound('Sell request not found');
  }
  // Only while the request is still waiting. Once the committee has confirmed it
  // they are already planning the pickup round around it, so it is theirs to
  // cancel from then on.
  const updated = await prisma.saleRequest.updateMany({
    where: { id: requestId, memberId, status: SALE_REQUEST_STATUS.REQUESTED },
    data: { status: SALE_REQUEST_STATUS.CANCELLED },
  });
  if (updated.count !== 1) {
    throw ApiError.badRequest('กรรมการรับเรื่องคำขอนี้แล้ว จึงลบคำขอไม่ได้');
  }

  return prisma.saleRequest.findUnique({
    where: { id: requestId },
    include: requestInclude,
  });
}
