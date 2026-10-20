import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { ROUTE_PLAN_STATUS, ROUTE_STOP_STATUS, SALE_REQUEST_STATUS } from '../config/constants.js';
import type { BuyerScope } from '../middleware/buyerScope.js';
import type { VillageScope } from '../middleware/villageScope.js';
import type { MarkRouteStopInput, RoutePlanStartInput } from '../validators/routePlanValidators.js';

// The pickup run, from the committee's acceptance to the buyer's windscreen.
//
// Every collection round has one run per village, built by the system: when the
// committee accepts a sell request whose member pinned a location, the request
// becomes a stop on its round's run and the unvisited stops are re-ordered into
// the shortest path (addRequestToRoundPlan). Cancelling the request takes its
// stop off again. The buyer sees the run straight away and marks each stop
// 'next' (driving there now) or 'collected' as they work down the list.
// Coordinates are copied onto the stop when it is added, so the route stays put
// even if a member later moves their pin.

const stopInclude = {
  request: {
    select: {
      id: true,
      estimatedQuantity: true,
      pickupAddress: true,
      status: true,
      note: true,
      member: {
        select: {
          id: true,
          memberCode: true,
          prefix: true,
          firstName: true,
          lastName: true,
          phone: true,
          household: true,
        },
      },
      items: { include: { wasteType: true } },
    },
  },
};

const planInclude = {
  buyer: { select: { id: true, buyerName: true, phone: true } },
  villageArea: { select: { id: true, villageName: true, moo: true } },
  round: { select: { id: true, roundDate: true, startTime: true, endTime: true } },
  stops: { include: stopInclude, orderBy: { sequence: 'asc' } },
} as const;

// Statuses a buyer still has work to do on. Completed plans drop off their
// board but stay readable through getPlan for history.
const OPEN_PLAN_STATUSES: string[] = [ROUTE_PLAN_STATUS.SENT, ROUTE_PLAN_STATUS.IN_PROGRESS];

// Stops the buyer has finished with: they keep their place at the head of the run.
const DONE_STOP_STATUSES: string[] = [ROUTE_STOP_STATUS.COLLECTED, ROUTE_STOP_STATUS.SKIPPED];

type Point = { lat: number; lng: number };

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function notifyBuyerAccounts(buyerId: number, title: string, message: string) {
  const accounts = await prisma.userAccount.findMany({
    where: { buyerId, status: 'active', role: { roleName: 'buyer' } },
    select: { id: true },
  });
  if (accounts.length === 0) return;

  await prisma.notification.createMany({
    data: accounts.map((account) => ({
      userId: account.id,
      title,
      message,
      notificationType: 'route_plan',
    })),
  });
}

async function notifyMember(memberId: number, title: string, message: string) {
  const account = await prisma.userAccount.findUnique({ where: { memberId } });
  if (!account) return;
  await prisma.notification.create({
    data: { userId: account.id, title, message, notificationType: 'sell_request' },
  });
}

// A request counts as "routed" while it sits on a live stop: any stop the buyer
// has not skipped, in a plan that was not cancelled (old flow). A collected stop
// stays routed too - the request is still 'confirmed' until the committee
// records the purchase.
export const activeRouteStopWhere: Prisma.PickupRouteStopWhereInput = {
  status: { not: ROUTE_STOP_STATUS.SKIPPED },
  plan: { status: { not: ROUTE_PLAN_STATUS.CANCELLED } },
};

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

function pathLength(points: Point[], origin: Point | null): number {
  let total = origin && points.length ? haversineKm(origin, points[0]!) : 0;
  for (let i = 0; i + 1 < points.length; i += 1) {
    total += haversineKm(points[i]!, points[i + 1]!);
  }
  return total;
}

// Nearest-neighbour from `start`, then 2-opt: reverse any segment that shortens
// the path until none does. Distances are straight-line (haversine) - good
// enough to order village-scale stops; real navigation is Google Maps' job.
function orderFrom<T extends Point>(stops: T[], start: Point, origin: Point | null): T[] {
  const remaining = [...stops];
  const ordered: T[] = [];
  let cursor = start;
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i += 1) {
      if (haversineKm(cursor, remaining[i]!) < haversineKm(cursor, remaining[best]!)) best = i;
    }
    const next = remaining.splice(best, 1)[0]!;
    ordered.push(next);
    cursor = next;
  }

  // An open path with no origin may start anywhere, so the first stop can move
  // too; with an origin, the leg from it is part of the length being cut.
  let improved = true;
  while (improved && ordered.length > 2) {
    improved = false;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const candidate = [
          ...ordered.slice(0, i),
          ...ordered.slice(i, j + 1).reverse(),
          ...ordered.slice(j + 1),
        ];
        if (pathLength(candidate, origin) + 1e-9 < pathLength(ordered, origin)) {
          ordered.splice(0, ordered.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return ordered;
}

// The shortest visiting order found for `stops`, starting from `origin` when
// there is one. Without one the run may begin at any stop, so every stop is
// tried as the first and the shortest result wins (a village run is a few
// dozen stops at most).
export function shortestOrder<T extends Point>(stops: T[], origin: Point | null): T[] {
  if (stops.length < 2) return [...stops];
  if (origin) return orderFrom(stops, origin, origin);
  let best: T[] = stops;
  let bestLength = Infinity;
  for (const first of stops) {
    const candidate = orderFrom(stops, first, null);
    const length = pathLength(candidate, null);
    if (length < bestLength) {
      best = candidate;
      bestLength = length;
    }
  }
  return best;
}

// sent until the buyer marks anything, completed once nothing is left to visit.
function planStatusOf(stopStatuses: string[]): string {
  const remaining = stopStatuses.filter(
    (status) => status === ROUTE_STOP_STATUS.PENDING || status === ROUTE_STOP_STATUS.NEXT,
  ).length;
  if (remaining === 0) return ROUTE_PLAN_STATUS.COMPLETED;
  return remaining < stopStatuses.length || stopStatuses.includes(ROUTE_STOP_STATUS.NEXT)
    ? ROUTE_PLAN_STATUS.IN_PROGRESS
    : ROUTE_PLAN_STATUS.SENT;
}

// Re-orders a plan: finished stops keep their place at the head, the stop the
// buyer is driving to comes next, and the unvisited ones follow in the shortest
// order from wherever the buyer will be. Leg and total distances are recomputed
// from the stored coordinates, and the plan status follows its stops.
export async function reorderPlan(tx: Prisma.TransactionClient, planId: number) {
  const plan = await tx.pickupRoutePlan.findUniqueOrThrow({
    where: { id: planId },
    include: { stops: { orderBy: { sequence: 'asc' } } },
  });
  const done = plan.stops.filter((stop) => DONE_STOP_STATUSES.includes(stop.status));
  const next = plan.stops.find((stop) => stop.status === ROUTE_STOP_STATUS.NEXT) ?? null;
  const pending = plan.stops.filter((stop) => stop.status === ROUTE_STOP_STATUS.PENDING);

  const start =
    plan.startLat !== null && plan.startLng !== null ? { lat: plan.startLat, lng: plan.startLng } : null;
  const origin = next ?? done[done.length - 1] ?? start;
  const ordered = [...done, ...(next ? [next] : []), ...shortestOrder(pending, origin)];

  let cursor: Point | null = start;
  let totalDistanceKm = 0;
  const rows = ordered.map((stop, index) => {
    const legDistanceKm = cursor ? haversineKm(cursor, stop) : 0;
    totalDistanceKm += legDistanceKm;
    cursor = stop;
    return { id: stop.id, sequence: index + 1, legDistanceKm };
  });

  if (rows.length) {
    const values = Prisma.join(
      rows.map(
        (row) =>
          Prisma.sql`(${row.id}::int, ${row.sequence}::int, ${row.legDistanceKm}::double precision)`,
      ),
    );
    await tx.$executeRaw`
      UPDATE pickup_route_stop AS s
      SET sequence = v.sequence, leg_distance_km = v.leg
      FROM (VALUES ${values}) AS v(id, sequence, leg)
      WHERE s.route_stop_id = v.id`;
  }

  await tx.pickupRoutePlan.update({
    where: { id: planId },
    data: {
      totalDistanceKm,
      status: planStatusOf(plan.stops.map((stop) => stop.status)),
    },
  });
}

// Serialises every change to one round's runs: two committee members accepting
// requests of the same round at once must not each create "the" plan.
async function lockRound(tx: Prisma.TransactionClient, roundId: number) {
  await tx.$queryRaw`SELECT round_id FROM collection_round WHERE round_id = ${roundId} FOR UPDATE`;
}

// ---------------------------------------------------------------------------
// Keeping a round's run in step with its accepted requests
// ---------------------------------------------------------------------------

export interface AddedStop {
  planId: number;
  buyerId: number;
  stopCount: number;
  villageName: string | null;
  roundDate: Date;
}

// Called inside the transaction that accepts the request. A request without a
// pinned location is accepted all the same but stays off the map (returns null).
export async function addRequestToRoundPlan(
  tx: Prisma.TransactionClient,
  requestId: number,
): Promise<AddedStop | null> {
  const request = await tx.saleRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      id: true,
      roundId: true,
      pickupLat: true,
      pickupLng: true,
      round: { select: { buyerId: true, roundDate: true } },
      member: {
        select: {
          household: {
            select: { villageAreaId: true, villageArea: { select: { villageName: true } } },
          },
        },
      },
    },
  });
  if (request.pickupLat === null || request.pickupLng === null) return null;

  await lockRound(tx, request.roundId);
  const villageAreaId = request.member.household?.villageAreaId ?? null;

  const onPlan = await tx.pickupRouteStop.findFirst({
    where: { requestId, plan: { roundId: request.roundId } },
    select: { id: true },
  });
  if (onPlan) return null;

  const plan =
    (await tx.pickupRoutePlan.findFirst({
      where: { roundId: request.roundId, villageAreaId },
      select: { id: true },
    })) ??
    (await tx.pickupRoutePlan.create({
      data: {
        roundId: request.roundId,
        villageAreaId,
        buyerId: request.round.buyerId,
        planDate: request.round.roundDate,
        status: ROUTE_PLAN_STATUS.SENT,
      },
      select: { id: true },
    }));

  await tx.pickupRouteStop.create({
    data: {
      planId: plan.id,
      requestId,
      // Re-numbered by reorderPlan straight away.
      sequence: 0,
      lat: request.pickupLat,
      lng: request.pickupLng,
      status: ROUTE_STOP_STATUS.PENDING,
    },
  });
  await reorderPlan(tx, plan.id);

  return {
    planId: plan.id,
    buyerId: request.round.buyerId,
    stopCount: await tx.pickupRouteStop.count({ where: { planId: plan.id } }),
    villageName: request.member.household?.villageArea?.villageName ?? null,
    roundDate: request.round.roundDate,
  };
}

// Called inside the transaction that cancels the request. A stop the buyer has
// already finished with stays as part of what happened on the run; one still
// ahead of them goes. A plan left with no stops goes too, so the next accepted
// request starts a fresh one.
export async function removeRequestFromRoundPlan(tx: Prisma.TransactionClient, requestId: number) {
  const stop = await tx.pickupRouteStop.findFirst({
    where: { requestId, status: { in: [ROUTE_STOP_STATUS.PENDING, ROUTE_STOP_STATUS.NEXT] } },
    select: { id: true, planId: true, plan: { select: { roundId: true } } },
  });
  if (!stop) return;

  if (stop.plan.roundId !== null) await lockRound(tx, stop.plan.roundId);
  await tx.pickupRouteStop.delete({ where: { id: stop.id } });

  const left = await tx.pickupRouteStop.count({ where: { planId: stop.planId } });
  if (left === 0) {
    await tx.pickupRoutePlan.delete({ where: { id: stop.planId } });
  } else {
    await reorderPlan(tx, stop.planId);
  }
}

// Tells the round's buyer a stop was added - after the accepting transaction
// has committed.
export async function notifyStopAdded(added: AddedStop) {
  const day = added.roundDate.toISOString().slice(0, 10);
  await notifyBuyerAccounts(
    added.buyerId,
    'มีจุดรับซื้อใหม่ในแผนที่',
    `${added.villageName ? `${added.villageName}: ` : ''}รอบวันที่ ${day} มีจุดรับซื้อเพิ่ม รวม ${added.stopCount} จุด`,
  );
}

// One-off repair, safe to run again: puts every accepted request that has a
// location but no stop onto its round's run, then re-orders every run. Used
// once when runs became per-round; nothing in the API calls it.
export async function syncAllRoundPlans() {
  const missing = await prisma.saleRequest.findMany({
    where: {
      status: SALE_REQUEST_STATUS.CONFIRMED,
      pickupLat: { not: null },
      pickupLng: { not: null },
      // A stop on an old cancelled plan (no round) doesn't count.
      routeStops: { none: { plan: { roundId: { not: null } } } },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  for (const request of missing) {
    await prisma.$transaction((tx) => addRequestToRoundPlan(tx, request.id));
  }

  const plans = await prisma.pickupRoutePlan.findMany({
    where: { roundId: { not: null } },
    select: { id: true },
  });
  for (const plan of plans) {
    await prisma.$transaction((tx) => reorderPlan(tx, plan.id));
  }
  return { added: missing.length, reordered: plans.length };
}

// ---------------------------------------------------------------------------
// Committee side: read the run, choose where it starts
// ---------------------------------------------------------------------------

function committeePlanWhere(
  scope: VillageScope | null,
  status?: string,
  roundId?: number,
): Prisma.PickupRoutePlanWhereInput {
  return {
    ...(scope ? { villageAreaId: scope.villageAreaId } : {}),
    ...(status && status !== 'all' ? { status } : {}),
    ...(roundId ? { roundId } : {}),
  };
}

export async function listPlansForCommittee(
  scope: VillageScope | null,
  status?: string,
  roundId?: number,
) {
  return prisma.pickupRoutePlan.findMany({
    where: committeePlanWhere(scope, status, roundId),
    include: planInclude,
    orderBy: { id: 'desc' },
  });
}

// One page of the committee's plans. Every plan carries all of its stops,
// members and waste items, so the list is paged rather than sent whole.
export async function listPlansForCommitteePage(
  scope: VillageScope | null,
  query: {
    status?: string | undefined;
    roundId?: number | undefined;
    page: number;
    pageSize: number;
  },
) {
  const where = committeePlanWhere(scope, query.status, query.roundId);
  const [total, items] = await Promise.all([
    prisma.pickupRoutePlan.count({ where }),
    prisma.pickupRoutePlan.findMany({
      where,
      include: planInclude,
      orderBy: { id: 'desc' },
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

// Where the run starts (the committee's pinned start point). The unvisited
// stops are re-ordered from it, so the buyer's list follows at once.
export async function setPlanStartPoint(
  planId: number,
  input: RoutePlanStartInput,
  scope: VillageScope | null,
) {
  const plan = await getPlan(planId, { villageScope: scope, buyerScope: null });
  await prisma.$transaction(async (tx) => {
    if (plan.roundId !== null) await lockRound(tx, plan.roundId);
    await tx.pickupRoutePlan.update({
      where: { id: planId },
      data: { startLat: input.lat, startLng: input.lng },
    });
    await reorderPlan(tx, planId);
  });
  return getPlan(planId, { villageScope: scope, buyerScope: null });
}

// ---------------------------------------------------------------------------
// Buyer side: work the stops
// ---------------------------------------------------------------------------

export async function listPlansForBuyer(scope: BuyerScope | null, status?: string) {
  return prisma.pickupRoutePlan.findMany({
    where: {
      ...(scope ? { buyerId: scope.buyerId } : {}),
      ...(status && status !== 'all' ? { status } : { status: { in: OPEN_PLAN_STATUSES } }),
    },
    include: planInclude,
    orderBy: { id: 'desc' },
  });
}

// Single lookup shared by both roles - whichever scope is present is the one
// that has to match, so neither a foreign village nor a foreign shop can read a
// plan by guessing its id.
export async function getPlan(
  planId: number,
  scopes: { villageScope: VillageScope | null; buyerScope: BuyerScope | null },
) {
  const plan = await prisma.pickupRoutePlan.findUnique({
    where: { id: planId },
    include: planInclude,
  });
  if (!plan) {
    throw ApiError.notFound('Route plan not found');
  }
  if (scopes.villageScope && plan.villageAreaId !== scopes.villageScope.villageAreaId) {
    throw ApiError.forbidden('ไม่มีสิทธิ์เข้าถึงแผนเส้นทางของหมู่บ้านอื่น');
  }
  if (scopes.buyerScope && plan.buyerId !== scopes.buyerScope.buyerId) {
    throw ApiError.forbidden('ไม่มีสิทธิ์เข้าถึงแผนเส้นทางของผู้รับซื้อรายอื่น');
  }

  return plan;
}

// Marks one stop and re-derives the plan status from its stops. The order is
// left alone - re-ordering under the buyer while they drive would be confusing.
//
// 'next' is exclusive: a buyer is driving to exactly one place at a time, so
// promoting a stop demotes whichever one held it. The member whose stop becomes
// 'next' gets told the truck is on its way - that is the whole point of the mark.
export async function markStop(
  planId: number,
  stopId: number,
  input: MarkRouteStopInput,
  buyerUserId: number,
  scope: BuyerScope | null,
) {
  const plan = await getPlan(planId, { villageScope: null, buyerScope: scope });
  if (plan.status === ROUTE_PLAN_STATUS.CANCELLED) {
    throw ApiError.badRequest('แผนนี้ถูกยกเลิกแล้ว');
  }

  const stop = plan.stops.find((row) => row.id === stopId);
  if (!stop) {
    throw ApiError.notFound('Route stop not found');
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (input.status === ROUTE_STOP_STATUS.NEXT) {
      await tx.pickupRouteStop.updateMany({
        where: { planId, status: ROUTE_STOP_STATUS.NEXT, id: { not: stopId } },
        data: { status: ROUTE_STOP_STATUS.PENDING },
      });
    }

    await tx.pickupRouteStop.update({
      where: { id: stopId },
      data: {
        status: input.status,
        markedAt: input.status === ROUTE_STOP_STATUS.PENDING ? null : now,
        markedBy: input.status === ROUTE_STOP_STATUS.PENDING ? null : buyerUserId,
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });

    const stops = await tx.pickupRouteStop.findMany({ where: { planId }, select: { status: true } });
    const nextPlanStatus = planStatusOf(stops.map((row) => row.status));
    if (nextPlanStatus !== plan.status) {
      await tx.pickupRoutePlan.update({ where: { id: planId }, data: { status: nextPlanStatus } });
    }
  });

  if (input.status === ROUTE_STOP_STATUS.NEXT && stop.status !== ROUTE_STOP_STATUS.NEXT) {
    await notifyMember(
      stop.request.member.id,
      'ผู้รับซื้อกำลังเดินทางไปรับขยะของคุณ',
      'ผู้รับซื้อกำลังมุ่งหน้าไปยังจุดรับของคุณเป็นจุดถัดไป กรุณาเตรียมขยะให้พร้อม',
    );
  }

  return getPlan(planId, { villageScope: null, buyerScope: scope });
}
