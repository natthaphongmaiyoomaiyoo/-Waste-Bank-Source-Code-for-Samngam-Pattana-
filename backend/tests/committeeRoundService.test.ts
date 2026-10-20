import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import {
  closeEndedRounds,
  createRound,
  getRoundsSummary,
  listRounds,
  updateRound,
} from '../src/services/committeeRoundService.js';
import { listUpcoming, roundWindowEnded } from '../src/services/scheduleService.js';
import { listRequests } from '../src/services/committeeSellRequestService.js';
import { create as createSellRequest } from '../src/services/sellRequestService.js';
import type { VillageScope } from '../src/middleware/villageScope.js';
import { createMember, createVillageArea } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// A round a committee opens belongs to its village: only that village's members
// see it on their schedule, and only they may book it.

let villageOne: VillageScope;
let villageTwo: VillageScope;
let buyerId: number;
let wasteTypeId: number;

function scopeOf(village: { id: number; villageName: string; moo: string | null }): VillageScope {
  return { villageAreaId: village.id, villageName: village.villageName, moo: village.moo ?? '' };
}

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Local Y-M-D, not toISOString(), so the day does not shift under UTC+7 - the
// advance-window boundary is exact to the day.
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const roundInput = () => ({
  roundDate: tomorrow(),
  startTime: '09:00',
  endTime: '12:00',
  buyerId,
});

beforeEach(async () => {
  await resetDb();
  villageOne = scopeOf(await createVillageArea('บ้านหนองน้ำ', '1'));
  villageTwo = scopeOf(await createVillageArea('บ้านโคกสูง', '2'));
  buyerId = (await prisma.buyer.create({ data: { buyerName: 'ร้านทดสอบ' } })).id;
  wasteTypeId = (
    await prisma.wasteType.create({
      data: { wasteName: 'ขวดพลาสติก', unit: 'kg', defaultPrice: 8 },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('committeeRoundService', () => {
  it('stamps the creating committee\'s village on the round', async () => {
    const round = await createRound(roundInput(), villageOne, 1);
    expect(round.villageArea?.id).toBe(villageOne.villageAreaId);

    // An admin (null scope) opens a municipality-wide round instead.
    const shared = await createRound(roundInput(), null, 1);
    expect(shared.villageArea).toBeNull();
  });

  it('lists own-village and municipality-wide rounds, never another village\'s', async () => {
    const mine = await createRound(roundInput(), villageOne, 1);
    const theirs = await createRound(roundInput(), villageTwo, 1);
    const shared = await createRound(roundInput(), null, 1);

    const listed = await listRounds({ scope: 'upcoming' }, villageOne);
    const ids = listed.items.map((round) => round.id).sort();
    expect(ids).toEqual([mine.id, shared.id].sort());
    expect(ids).not.toContain(theirs.id);
  });

  it('calculates summary cards from the same filters as the visible table', async () => {
    const planned = await createRound(roundInput(), villageOne, 1);
    const completed = await createRound(roundInput(), villageOne, 1);
    await prisma.collectionRound.update({
      where: { id: completed.id },
      data: { status: 'completed' },
    });
    await createRound(roundInput(), villageTwo, 1);

    const filters = { scope: 'upcoming' as const };
    const listed = await listRounds(filters, villageOne);
    const summary = await getRoundsSummary(filters, villageOne);

    expect(summary).toEqual({
      total: listed.items.length,
      planned: 1,
      completed: 1,
      cancelled: 0,
    });
    expect(summary.total).toBe(summary.planned + summary.completed + summary.cancelled);
    expect(listed.items.map((round) => round.id)).toContain(planned.id);

    const completedOnly = await getRoundsSummary(
      { scope: 'upcoming', status: 'completed' },
      villageOne,
    );
    expect(completedOnly).toEqual({
      total: 1,
      planned: 0,
      completed: 1,
      cancelled: 0,
    });
  });

  // The rule the booking check and the auto-close job share.
  it('counts a round as closed once its end time has passed', () => {
    const round = { roundDate: new Date('2026-08-17'), endTime: '17:00' };

    expect(roundWindowEnded(round, new Date(2026, 7, 17, 16, 59))).toBe(false);
    expect(roundWindowEnded(round, new Date(2026, 7, 17, 17, 1))).toBe(true);
    expect(roundWindowEnded(round, new Date(2026, 7, 18, 8, 0))).toBe(true);
  });

  it('closes rounds automatically once their end time has passed, and only those', async () => {
    // Stored the way the API stores a round date: the calendar day at UTC midnight.
    const make = (days: number, endTime: string, status = 'planned') =>
      prisma.collectionRound.create({
        data: {
          roundDate: new Date(daysFromNow(days)),
          startTime: '08:00',
          endTime,
          buyerId,
          status,
          villageAreaId: villageOne.villageAreaId,
        },
      });
    const endedYesterday = await make(-1, '17:00');
    const endedThisMorning = await make(0, '10:00');
    const stillRunning = await make(0, '16:00');
    const tomorrowRound = await make(1, '12:00');
    const cancelled = await make(-2, '12:00', 'cancelled');

    const oneOClockToday = new Date();
    oneOClockToday.setHours(13, 0, 0, 0);
    expect(await closeEndedRounds(oneOClockToday)).toBe(2);

    const statusOf = async (id: number) =>
      (await prisma.collectionRound.findUniqueOrThrow({ where: { id } })).status;
    expect(await statusOf(endedYesterday.id)).toBe('completed');
    expect(await statusOf(endedThisMorning.id)).toBe('completed');
    expect(await statusOf(stillRunning.id)).toBe('planned');
    expect(await statusOf(tomorrowRound.id)).toBe('planned');
    expect(await statusOf(cancelled.id)).toBe('cancelled');

    // Nothing left to close the next minute.
    expect(await closeEndedRounds(oneOClockToday)).toBe(0);
  });

  it('refuses to open a round dated in the past', async () => {
    await expect(
      createRound({ ...roundInput(), roundDate: daysFromNow(-1) }, villageOne, 1),
    ).rejects.toMatchObject({ statusCode: 400 });

    // Today itself is still fine - the committee may open a round the same morning.
    await expect(
      createRound({ ...roundInput(), roundDate: daysFromNow(0) }, villageOne, 1),
    ).resolves.toMatchObject({ villageAreaId: villageOne.villageAreaId });
  });

  it('refuses to edit another village\'s round or the shared one', async () => {
    const theirs = await createRound(roundInput(), villageTwo, 1);
    const shared = await createRound(roundInput(), null, 1);

    await expect(updateRound(theirs.id, { startTime: '08:00' }, villageOne)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(updateRound(shared.id, { startTime: '08:00' }, villageOne)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('shows a member only their own village rounds plus the shared ones', async () => {
    const mine = await createRound(roundInput(), villageOne, 1);
    const theirs = await createRound(roundInput(), villageTwo, 1);
    const shared = await createRound(roundInput(), null, 1);
    const member = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });

    const visible = await listUpcoming({ memberId: member.id, roleName: 'member' });
    const ids = visible.map((round) => round.id).sort();
    expect(ids).toEqual([mine.id, shared.id].sort());
    expect(ids).not.toContain(theirs.id);
  });

  it('accepts sell requests only for rounds inside the 7-day advance window', async () => {
    const lastDayIn = await createRound({ ...roundInput(), roundDate: daysFromNow(7) }, villageOne, 1);
    const tooFar = await createRound({ ...roundInput(), roundDate: daysFromNow(8) }, villageOne, 1);
    const member = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    const items = [{ wasteTypeId, estimatedQuantity: 5 }];

    await expect(createSellRequest(member.id, { roundId: tooFar.id, items })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      createSellRequest(member.id, { roundId: lastDayIn.id, items }),
    ).resolves.toMatchObject({ roundId: lastDayIn.id });

    // The round the member can't book yet still shows on their schedule, with
    // the date it opens.
    const scheduled = await listUpcoming({ memberId: member.id, roleName: 'member' });
    expect(scheduled.find((round) => round.id === tooFar.id)?.openForRequest).toBe(false);
    expect(scheduled.find((round) => round.id === lastDayIn.id)?.openForRequest).toBe(true);
  });

  it('counts only the viewing committee\'s own members on a municipality-wide round', async () => {
    const shared = await createRound(roundInput(), null, 1);
    const mine = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    const theirs = await createMember({ villageAreaId: villageTwo.villageAreaId, moo: '2' });
    const items = [{ wasteTypeId, estimatedQuantity: 5 }];
    await createSellRequest(mine.id, { roundId: shared.id, items });
    await createSellRequest(theirs.id, { roundId: shared.id, items });

    // The count on the round card has to equal what opening the round shows -
    // an unfiltered count would say 2 here and then list only 1.
    const card = (await listRounds({ scope: 'upcoming' }, villageOne)).items.find(
      (round) => round.id === shared.id,
    );
    const listed = await listRequests({ page: 1, pageSize: 20, roundId: shared.id }, villageOne);

    expect(card?._count.saleRequests).toBe(1);
    expect(listed.total).toBe(1);
  });

  it('rejects a sell request booked against another village\'s round', async () => {
    const theirs = await createRound(roundInput(), villageTwo, 1);
    const shared = await createRound(roundInput(), null, 1);
    const member = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });

    await expect(
      createSellRequest(member.id, {
        roundId: theirs.id,
        items: [{ wasteTypeId, estimatedQuantity: 5 }],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    // The municipality-wide round is still bookable by everyone.
    await expect(
      createSellRequest(member.id, {
        roundId: shared.id,
        items: [{ wasteTypeId, estimatedQuantity: 5 }],
      }),
    ).resolves.toMatchObject({ roundId: shared.id });
  });
});
