import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { cancelRequest, confirmRequest } from '../src/services/committeeSellRequestService.js';
import {
  getPlan,
  listPlansForBuyer,
  listPlansForCommitteePage,
  markStop,
  setPlanStartPoint,
  shortestOrder,
} from '../src/services/routePlanService.js';
import type { BuyerScope } from '../src/middleware/buyerScope.js';
import type { VillageScope } from '../src/middleware/villageScope.js';
import { createMember, createVillageArea } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

let villageOne: VillageScope;
let villageTwo: VillageScope;
let buyerScope: BuyerScope;
let otherBuyerScope: BuyerScope;
let buyerUserId: number;
let roundId: number;

function scopeOf(village: { id: number; villageName: string; moo: string | null }): VillageScope {
  return { villageAreaId: village.id, villageName: village.villageName, moo: village.moo ?? '' };
}

async function createAccount(roleName: string, username: string, data: object = {}) {
  const role = await prisma.role.upsert({
    where: { roleName },
    update: {},
    create: { roleName, description: roleName },
  });
  return prisma.userAccount.create({
    data: { username, passwordHash: 'x', fullName: `Test ${roleName}`, roleId: role.id, ...data },
  });
}

// A member's sell request waiting for the committee, pinned at the given
// coordinates (or not pinned at all).
async function createRequest(
  villageAreaId: number,
  point: { lat: number; lng: number } | null,
  round = roundId,
) {
  const member = await createMember({ villageAreaId, withUserAccount: true });
  return prisma.saleRequest.create({
    data: {
      memberId: member.id,
      roundId: round,
      estimatedQuantity: 10,
      status: 'requested',
      pickupLat: point?.lat ?? null,
      pickupLng: point?.lng ?? null,
    },
  });
}

// Created and accepted by the committee - which is what puts it on the run.
async function acceptedRequest(villageAreaId: number, lat: number, lng: number, round = roundId) {
  const request = await createRequest(villageAreaId, { lat, lng }, round);
  await confirmRequest(request.id);
  return request;
}

async function roundPlans(round = roundId) {
  return prisma.pickupRoutePlan.findMany({
    where: { roundId: round },
    include: { stops: { orderBy: { sequence: 'asc' } } },
  });
}

beforeEach(async () => {
  await resetDb();
  villageOne = scopeOf(await createVillageArea('บ้านหนองน้ำ', '1'));
  villageTwo = scopeOf(await createVillageArea('บ้านโคกสูง', '2'));

  const buyer = await prisma.buyer.create({ data: { buyerName: 'ร้านรับซื้อทดสอบ' } });
  const otherBuyer = await prisma.buyer.create({ data: { buyerName: 'ร้านคู่แข่ง' } });
  buyerScope = { buyerId: buyer.id, buyerName: buyer.buyerName };
  otherBuyerScope = { buyerId: otherBuyer.id, buyerName: otherBuyer.buyerName };

  await createAccount('committee', 'test-committee', { villageAreaId: villageOne.villageAreaId });
  buyerUserId = (await createAccount('buyer', 'test-buyer', { buyerId: buyer.id })).id;

  roundId = (
    await prisma.collectionRound.create({
      data: {
        roundDate: new Date(),
        startTime: '09:00',
        endTime: '12:00',
        buyerId: buyer.id,
        status: 'planned',
      },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('routePlanService.shortestOrder', () => {
  // Three stops on a line, given out of order.
  const a = { name: 'a', lat: 13.3, lng: 100.9 };
  const b = { name: 'b', lat: 13.31, lng: 100.9 };
  const c = { name: 'c', lat: 13.32, lng: 100.9 };

  it('without a start, walks the line end to end', () => {
    const names = shortestOrder([a, c, b], null).map((stop) => stop.name).join('');
    expect(['abc', 'cba']).toContain(names);
  });

  it('with a start, begins at the stop nearest to it', () => {
    const order = shortestOrder([a, c, b], { lat: 13.33, lng: 100.9 });
    expect(order.map((stop) => stop.name)).toEqual(['c', 'b', 'a']);
  });
});

describe('accepting a sell request builds the round\'s run', () => {
  it('puts a pinned request on its round\'s run, visible to the buyer at once', async () => {
    const request = await acceptedRequest(villageOne.villageAreaId, 13.28, 100.92);

    const [plan] = await roundPlans();
    expect(plan).toBeDefined();
    expect(plan!.villageAreaId).toBe(villageOne.villageAreaId);
    expect(plan!.buyerId).toBe(buyerScope.buyerId);
    expect(plan!.status).toBe('sent');
    expect(plan!.stops.map((stop) => [stop.requestId, stop.sequence])).toEqual([[request.id, 1]]);

    expect((await listPlansForBuyer(buyerScope)).map((row) => row.id)).toEqual([plan!.id]);
    const notifications = await prisma.notification.findMany({ where: { userId: buyerUserId } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.notificationType).toBe('route_plan');
  });

  it('keeps one run per round, re-ordered shortest-first as stops join', async () => {
    const a = await acceptedRequest(villageOne.villageAreaId, 13.3, 100.9);
    const c = await acceptedRequest(villageOne.villageAreaId, 13.32, 100.9);
    const b = await acceptedRequest(villageOne.villageAreaId, 13.31, 100.9);

    const plans = await roundPlans();
    expect(plans).toHaveLength(1);
    const order = plans[0]!.stops.map((stop) => stop.requestId);
    expect([[a.id, b.id, c.id], [c.id, b.id, a.id]]).toContainEqual(order);
    expect(plans[0]!.stops.map((stop) => stop.sequence)).toEqual([1, 2, 3]);
    expect(plans[0]!.totalDistanceKm).toBeGreaterThan(0);
  });

  it('accepts a request without a pinned location but leaves it off the run', async () => {
    const request = await createRequest(villageOne.villageAreaId, null);
    const accepted = await confirmRequest(request.id);

    expect(accepted.status).toBe('confirmed');
    expect(await roundPlans()).toHaveLength(0);
  });

  it('gives each village its own run in a round open to every village', async () => {
    await acceptedRequest(villageOne.villageAreaId, 13.28, 100.92);
    await acceptedRequest(villageTwo.villageAreaId, 13.4, 100.99);

    const plans = await roundPlans();
    expect(plans.map((plan) => plan.villageAreaId).sort()).toEqual(
      [villageOne.villageAreaId, villageTwo.villageAreaId].sort(),
    );

    const ownPage = await listPlansForCommitteePage(villageOne, { roundId, page: 1, pageSize: 10 });
    expect(ownPage.items.map((plan) => plan.villageAreaId)).toEqual([villageOne.villageAreaId]);
  });

  it('keeps another round\'s run out of the round being viewed', async () => {
    await acceptedRequest(villageOne.villageAreaId, 13.28, 100.92);
    const laterRound = await prisma.collectionRound.create({
      data: { roundDate: new Date(), startTime: '13:00', endTime: '16:00', buyerId: buyerScope.buyerId, status: 'planned' },
    });
    await acceptedRequest(villageOne.villageAreaId, 13.3, 100.94, laterRound.id);

    const page = await listPlansForCommitteePage(villageOne, { roundId, page: 1, pageSize: 10 });
    expect(page.total).toBe(1);
    expect(page.items[0]!.roundId).toBe(roundId);
  });

  it('takes a cancelled request off the run, and drops the run with its last stop', async () => {
    const first = await acceptedRequest(villageOne.villageAreaId, 13.28, 100.92);
    const second = await acceptedRequest(villageOne.villageAreaId, 13.3, 100.94);

    await cancelRequest(first.id);
    let plans = await roundPlans();
    expect(plans[0]!.stops.map((stop) => [stop.requestId, stop.sequence])).toEqual([[second.id, 1]]);

    await cancelRequest(second.id);
    plans = await roundPlans();
    expect(plans).toHaveLength(0);
  });

  it('re-orders the unvisited stops from the start point the committee picks', async () => {
    const a = await acceptedRequest(villageOne.villageAreaId, 13.3, 100.9);
    const b = await acceptedRequest(villageOne.villageAreaId, 13.31, 100.9);
    const c = await acceptedRequest(villageOne.villageAreaId, 13.32, 100.9);
    const [plan] = await roundPlans();

    const updated = await setPlanStartPoint(plan!.id, { lat: 13.33, lng: 100.9 }, villageOne);

    expect(updated.startLat).toBe(13.33);
    expect(updated.stops.map((stop) => stop.requestId)).toEqual([c.id, b.id, a.id]);
    // The first leg now runs from the start point.
    expect(updated.stops[0]!.legDistanceKm).toBeGreaterThan(0);
  });

  it('refuses another village\'s committee setting the start point', async () => {
    await acceptedRequest(villageOne.villageAreaId, 13.3, 100.9);
    const [plan] = await roundPlans();

    await expect(
      setPlanStartPoint(plan!.id, { lat: 13.33, lng: 100.9 }, villageTwo),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('keeps stops the buyer already worked at the head when a new one joins', async () => {
    await acceptedRequest(villageOne.villageAreaId, 13.3, 100.9);
    await acceptedRequest(villageOne.villageAreaId, 13.32, 100.9);
    let [plan] = await roundPlans();
    const firstStop = plan!.stops[0]!;
    await markStop(plan!.id, firstStop.id, { status: 'collected' }, buyerUserId, buyerScope);

    await acceptedRequest(villageOne.villageAreaId, 13.31, 100.9);

    [plan] = await roundPlans();
    expect(plan!.stops[0]!.id).toBe(firstStop.id);
    expect(plan!.stops[0]!.status).toBe('collected');
    expect(plan!.stops).toHaveLength(3);
    expect(plan!.status).toBe('in_progress');
  });
});

describe('routePlanService buyer board', () => {
  async function seedPlan() {
    await acceptedRequest(villageOne.villageAreaId, 13.28, 100.92);
    await acceptedRequest(villageOne.villageAreaId, 13.3, 100.94);
    const [plan] = await roundPlans();
    return getPlan(plan!.id, { villageScope: null, buyerScope });
  }

  it('shows a plan only to the shop it was addressed to', async () => {
    const plan = await seedPlan();

    expect((await listPlansForBuyer(buyerScope)).map((row) => row.id)).toEqual([plan.id]);
    expect(await listPlansForBuyer(otherBuyerScope)).toEqual([]);
    await expect(
      getPlan(plan.id, { villageScope: null, buyerScope: otherBuyerScope }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('keeps "next" exclusive - marking one stop demotes the previous one', async () => {
    const plan = await seedPlan();
    const [first, second] = plan.stops;

    await markStop(plan.id, first!.id, { status: 'next' }, buyerUserId, buyerScope);
    const afterSecond = await markStop(
      plan.id,
      second!.id,
      { status: 'next' },
      buyerUserId,
      buyerScope,
    );

    const byId = new Map(afterSecond.stops.map((stop) => [stop.id, stop.status]));
    expect(byId.get(first!.id)).toBe('pending');
    expect(byId.get(second!.id)).toBe('next');
    expect(afterSecond.status).toBe('in_progress');
  });

  it('tells the member when their stop becomes the next one', async () => {
    const plan = await seedPlan();
    const stop = plan.stops[0]!;

    await markStop(plan.id, stop.id, { status: 'next' }, buyerUserId, buyerScope);

    const account = await prisma.userAccount.findUnique({
      where: { memberId: stop.request.member.id },
    });
    const notifications = await prisma.notification.findMany({ where: { userId: account!.id } });
    expect(notifications.map((row) => row.title)).toContain(
      'ผู้รับซื้อกำลังเดินทางไปรับขยะของคุณ',
    );
  });

  it('completes the plan once no stop is left pending', async () => {
    const plan = await seedPlan();

    await markStop(plan.id, plan.stops[0]!.id, { status: 'collected' }, buyerUserId, buyerScope);
    const done = await markStop(
      plan.id,
      plan.stops[1]!.id,
      { status: 'collected' },
      buyerUserId,
      buyerScope,
    );

    expect(done.status).toBe('completed');
    // Completed plans drop off the buyer's active board.
    expect(await listPlansForBuyer(buyerScope)).toEqual([]);
  });

  it('refuses a stop that belongs to another shop\'s plan', async () => {
    const plan = await seedPlan();

    await expect(
      markStop(plan.id, plan.stops[0]!.id, { status: 'collected' }, buyerUserId, otherBuyerScope),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
