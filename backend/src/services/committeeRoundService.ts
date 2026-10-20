import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { COLLECTION_ROUND_STATUS } from '../config/constants.js';
import type { VillageScope } from '../middleware/villageScope.js';
import { memberScopeWhere, roundScopeWhere } from './villageScopeService.js';
import { localTimeSql, thaiDateSearchSql } from '../utils/thaiDateSql.js';
import { roundWindowEnded } from './scheduleService.js';
import type {
  CommitteeRoundCreateInput,
  CommitteeRoundListQuery,
  CommitteeRoundUpdateInput,
} from '../validators/committeeRoundValidators.js';

// Collection rounds scheduled by a village committee. A round created here is
// stamped with the committee's own village, and only that village's members are
// offered it (scheduleService) or allowed to submit a sell request against it
// (sellRequestService). Rounds with no village are municipality-wide and belong
// to the admin - a committee can see them but never edit them.

// The request count carries the same village filter as the sell-request list
// (committeeSellRequestService.listRequests). Counting every request on the
// round instead would overstate municipality-wide rounds, which members of any
// village may book: the committee would see "3 คำร้อง" and open an empty list.
function roundInclude(scope: VillageScope | null) {
  return {
    buyer: { select: { id: true, buyerName: true, phone: true } },
    villageArea: { select: { id: true, villageName: true, moo: true } },
    _count: { select: { saleRequests: { where: { member: memberScopeWhere(scope) } } } },
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

// Editing/cancelling is stricter than viewing: only rounds that belong to the
// committee's own village, never the shared municipality-wide ones.
async function findEditableRound(roundId: number, scope: VillageScope | null) {
  const round = await prisma.collectionRound.findUnique({ where: { id: roundId } });
  if (!round) {
    throw ApiError.notFound('ไม่พบรอบรับซื้อนี้');
  }
  if (scope && round.villageAreaId !== scope.villageAreaId) {
    throw ApiError.forbidden('แก้ไขได้เฉพาะรอบรับซื้อของหมู่บ้านที่รับผิดชอบเท่านั้น');
  }
  return round;
}

async function assertBuyerUsable(buyerId: number) {
  const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
  if (!buyer) {
    throw ApiError.notFound('ไม่พบผู้รับซื้อที่เลือก');
  }
  if (buyer.status !== 'active') {
    throw ApiError.badRequest('ผู้รับซื้อที่เลือกถูกระงับการใช้งานอยู่');
  }
}

export async function listRounds(query: CommitteeRoundListQuery, scope: VillageScope | null) {
  const where = roundListWhere(query, scope);
  if (query.search) {
    where.id = { in: await roundIdsMatching(query.search) };
  }
  const direction = query.descending ? 'desc' : 'asc';
  const orderBy: Prisma.CollectionRoundOrderByWithRelationInput[] = [
    { roundDate: direction },
    { startTime: direction },
  ];

  if (!query.page) {
    const items = await prisma.collectionRound.findMany({
      where,
      include: roundInclude(scope),
      orderBy,
    });
    return { items, total: items.length };
  }

  const [total, items] = await Promise.all([
    prisma.collectionRound.count({ where }),
    prisma.collectionRound.findMany({
      where,
      include: roundInclude(scope),
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

// One round, for a page that needs a single round's header. Same visibility as
// the list: the committee's own village plus the municipality-wide rounds.
export async function getRound(roundId: number, scope: VillageScope | null) {
  const round = await prisma.collectionRound.findFirst({
    where: { id: roundId, ...roundScopeWhere(scope) },
    include: roundInclude(scope),
  });
  if (!round) {
    throw ApiError.notFound('ไม่พบรอบรับซื้อนี้');
  }
  return round;
}

// Ids of the rounds whose displayed text contains `search`: the Thai date in
// both the long ("วันจันทร์ที่ 21 กันยายน 2569") and short ("จ. 21 ก.ย. 2569")
// forms, "08:00 - 10:00", the buyer, the meeting point and the village label.
// Built by the database so the search covers every round, not one page.
async function roundIdsMatching(search: string): Promise<number[]> {
  const like = `%${search.toLowerCase()}%`;
  const roundDay = localTimeSql(Prisma.sql`cr.round_date`);
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT cr.round_id AS id
    FROM collection_round cr
    JOIN buyer b ON b.buyer_id = cr.buyer_id
    LEFT JOIN village_area va ON va.village_area_id = cr.village_area_id
    WHERE LOWER(concat_ws(' | ',
      ${thaiDateSearchSql(roundDay)},
      cr.start_time || ' - ' || cr.end_time,
      b.buyer_name,
      cr.location_note,
      CASE
        WHEN cr.village_area_id IS NULL THEN 'รอบกลางของเทศบาล'
        ELSE 'หมู่ ' || COALESCE(va.moo, '-') || ' ' || va.village_name
      END
    )) LIKE ${like}
  `;
  return rows.map((row) => row.id);
}

function roundListWhere(
  query: CommitteeRoundListQuery,
  scope: VillageScope | null,
): Prisma.CollectionRoundWhereInput {
  return {
    ...(query.ownVillageOnly && scope
      ? { villageAreaId: scope.villageAreaId }
      : roundScopeWhere(scope)),
    ...(query.status ? { status: query.status } : {}),
    ...(query.scope === 'upcoming' ? { roundDate: { gte: startOfToday() } } : {}),
  };
}

export async function getRoundsSummary(
  query: CommitteeRoundListQuery,
  scope: VillageScope | null,
) {
  // Use exactly the same scope/status/date filters as the table. This keeps
  // every card reconcilable with the rows currently visible to the committee.
  const where = roundListWhere(query, scope);
  const [total, planned, completed, cancelled] = await Promise.all([
    prisma.collectionRound.count({ where }),
    prisma.collectionRound.count({
      where: { AND: [where, { status: COLLECTION_ROUND_STATUS.PLANNED }] },
    }),
    prisma.collectionRound.count({
      where: { AND: [where, { status: COLLECTION_ROUND_STATUS.COMPLETED }] },
    }),
    prisma.collectionRound.count({
      where: { AND: [where, { status: COLLECTION_ROUND_STATUS.CANCELLED }] },
    }),
  ]);

  return { total, planned, completed, cancelled };
}

export async function createRound(
  input: CommitteeRoundCreateInput,
  scope: VillageScope | null,
  createdBy: number,
) {
  await assertBuyerUsable(input.buyerId);

  // A back-dated round is dead on arrival - sellRequestService refuses a round
  // whose date has passed, so nobody could ever book it. The UI greys those days
  // out; this is what stops a hand-typed payload.
  const roundDate = new Date(input.roundDate);
  if (roundDate < startOfToday()) {
    throw ApiError.badRequest('เปิดรอบรับซื้อย้อนหลังไม่ได้ เลือกวันที่ตั้งแต่วันนี้เป็นต้นไป');
  }

  const round = await prisma.collectionRound.create({
    data: {
      roundDate,
      startTime: input.startTime,
      endTime: input.endTime,
      buyerId: input.buyerId,
      locationNote: input.locationNote ?? null,
      // Never from the client: a committee can only ever open a round for the
      // village it was assigned. An admin creating one leaves it open to all.
      villageAreaId: scope?.villageAreaId ?? null,
      status: COLLECTION_ROUND_STATUS.PLANNED,
      createdBy,
    },
    include: roundInclude(scope),
  });

  await notifyVillageMembers(round.id, scope);
  return round;
}

export async function updateRound(
  roundId: number,
  input: CommitteeRoundUpdateInput,
  scope: VillageScope | null,
) {
  const round = await findEditableRound(roundId, scope);
  if (round.status !== COLLECTION_ROUND_STATUS.PLANNED) {
    throw ApiError.badRequest('แก้ไขได้เฉพาะรอบที่ยังไม่เสร็จสิ้นหรือยังไม่ถูกยกเลิก');
  }
  if (input.buyerId !== undefined) {
    await assertBuyerUsable(input.buyerId);
  }

  return prisma.collectionRound.update({
    where: { id: roundId },
    data: {
      ...(input.roundDate !== undefined ? { roundDate: new Date(input.roundDate) } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.buyerId !== undefined ? { buyerId: input.buyerId } : {}),
      // '' clears the note (stored as null, like a round created without one).
      ...(input.locationNote !== undefined ? { locationNote: input.locationNote || null } : {}),
    },
    include: roundInclude(scope),
  });
}

export async function cancelRound(roundId: number, scope: VillageScope | null) {
  const round = await findEditableRound(roundId, scope);
  if (round.status === COLLECTION_ROUND_STATUS.COMPLETED) {
    throw ApiError.badRequest('รอบที่เสร็จสิ้นแล้วไม่สามารถยกเลิกได้');
  }

  return prisma.collectionRound.update({
    where: { id: roundId },
    data: { status: COLLECTION_ROUND_STATUS.CANCELLED },
    include: roundInclude(scope),
  });
}

export async function completeRound(roundId: number, scope: VillageScope | null) {
  const round = await findEditableRound(roundId, scope);
  if (round.status !== COLLECTION_ROUND_STATUS.PLANNED) {
    throw ApiError.badRequest('ปิดรอบได้เฉพาะรอบที่ยังเปิดอยู่');
  }

  return prisma.collectionRound.update({
    where: { id: roundId },
    data: { status: COLLECTION_ROUND_STATUS.COMPLETED },
    include: roundInclude(scope),
  });
}

// Closes every round whose own time window is over: still 'planned', and its
// date + end time has passed (scheduleService.roundWindowEnded - the same rule
// that stops members booking it). Run by jobs/roundAutoClose every minute, so a
// round no longer waits for the committee to press "ปิดรอบ". Closing only sets
// the status - purchases for the round can still be recorded afterwards.
export async function closeEndedRounds(now = new Date()) {
  // Every candidate is dated today or earlier; the end time itself is checked
  // below with the shared rule.
  const candidates = await prisma.collectionRound.findMany({
    where: { status: COLLECTION_ROUND_STATUS.PLANNED, roundDate: { lte: now } },
    select: { id: true, roundDate: true, endTime: true },
  });
  const ended = candidates.filter((round) => roundWindowEnded(round, now)).map((round) => round.id);
  if (!ended.length) return 0;

  // Still guarded on 'planned', so a round cancelled in the meantime stays so.
  const { count } = await prisma.collectionRound.updateMany({
    where: { id: { in: ended }, status: COLLECTION_ROUND_STATUS.PLANNED },
    data: { status: COLLECTION_ROUND_STATUS.COMPLETED },
  });
  return count;
}

// Buyer options for the round form (the committee cannot reach the admin
// master-data endpoints).
export async function listBuyers() {
  return prisma.buyer.findMany({
    where: { status: 'active' },
    select: { id: true, buyerName: true, phone: true },
    orderBy: { buyerName: 'asc' },
  });
}

// Tells the village's own members a new round is open. Scoped exactly like the
// round itself, so nobody outside the village is notified.
async function notifyVillageMembers(roundId: number, scope: VillageScope | null) {
  const round = await prisma.collectionRound.findUnique({
    where: { id: roundId },
    include: { buyer: { select: { buyerName: true } } },
  });
  if (!round) return;

  const accounts = await prisma.userAccount.findMany({
    where: {
      status: 'active',
      member: {
        status: 'active',
        ...(scope ? { household: { villageAreaId: scope.villageAreaId } } : {}),
      },
    },
    select: { id: true },
  });
  if (accounts.length === 0) return;

  const dateText = round.roundDate.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  await prisma.notification.createMany({
    data: accounts.map((account) => ({
      userId: account.id,
      title: 'เปิดรอบรับซื้อขยะใหม่',
      message: `วันที่ ${dateText} เวลา ${round.startTime}-${round.endTime} น.${
        round.locationNote ? ` (${round.locationNote})` : ''
      } แจ้งขายขยะได้แล้ว`,
      notificationType: 'schedule',
    })),
  });
}
