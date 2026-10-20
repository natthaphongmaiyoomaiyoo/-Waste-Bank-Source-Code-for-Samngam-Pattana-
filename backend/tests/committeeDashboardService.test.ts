import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { getDashboard } from '../src/services/committeeDashboardService.js';
import type { VillageScope } from '../src/middleware/villageScope.js';
import { createMember, createVillageArea } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// The dashboard is read-only, so what has to hold is (a) every figure stops at
// the committee's own village and (b) the derived counts - below-minimum, at
// risk - say what the committee thinks they say.

let villageOne: VillageScope;
let villageTwo: VillageScope;

function scopeOf(village: { id: number; villageName: string; moo: string | null }): VillageScope {
  return { villageAreaId: village.id, villageName: village.villageName, moo: village.moo ?? '' };
}

beforeEach(async () => {
  await resetDb();
  villageOne = scopeOf(await createVillageArea('บ้านหนองน้ำ', '1'));
  villageTwo = scopeOf(await createVillageArea('บ้านโคกสูง', '2'));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('committeeDashboardService.getDashboard', () => {
  it('counts only the committee\'s own village, and everything for an admin', async () => {
    await createMember({ villageAreaId: villageOne.villageAreaId, totalContribution: 50 });
    await createMember({ villageAreaId: villageOne.villageAreaId, status: 'pending' });
    await createMember({ villageAreaId: villageTwo.villageAreaId, totalContribution: 90 });

    const own = await getDashboard(villageOne);
    expect(own.village).toEqual({
      id: villageOne.villageAreaId,
      villageName: 'บ้านหนองน้ำ',
      moo: '1',
    });
    expect(own.members.total).toBe(2);
    expect(own.members.pendingApproval).toBe(1);
    expect(own.fund.totalBalance).toBe(50);

    const admin = await getDashboard(null);
    expect(admin.village).toBeNull();
    expect(admin.members.total).toBe(3);
    expect(admin.fund.totalBalance).toBe(140);
  });

  it('reports total savings, who is short of the 50-baht minimum, and by how much', async () => {
    await createMember({ villageAreaId: villageOne.villageAreaId, totalContribution: 170 });
    await createMember({ villageAreaId: villageOne.villageAreaId, totalContribution: 20 });
    await createMember({ villageAreaId: villageOne.villageAreaId, totalContribution: 0 });
    // Only ACTIVE members are required to hold the stake, so a resigned member
    // is not counted as short of it - but their money is still in the fund.
    await createMember({
      villageAreaId: villageOne.villageAreaId,
      status: 'resigned',
      totalContribution: 10,
    });

    const report = await getDashboard(villageOne);

    expect(report.fund.totalBalance).toBe(200);
    expect(report.fund.activeMemberCount).toBe(3);
    expect(report.fund.requiredTotal).toBe(150);
    expect(report.fund.belowMinimumCount).toBe(2);
    expect(report.fund.fullyContributedCount).toBe(1);
    // (50 - 20) + (50 - 0)
    expect(report.fund.belowMinimumShortfall).toBe(80);
    expect(report.members.belowMinimumMembers.map((row) => row.shortfall)).toEqual([50, 30]);
  });

  it('flags an eligible member with no buffer left as ใกล้ขาดสิทธิ', async () => {
    const now = new Date();
    const buyer = await prisma.buyer.create({ data: { buyerName: 'ร้านทดสอบ' } });
    const round = await prisma.collectionRound.create({
      data: {
        roundDate: now,
        startTime: '09:00',
        endTime: '12:00',
        buyerId: buyer.id,
        villageAreaId: villageOne.villageAreaId,
      },
    });

    // Approved long enough, sold in exactly the six months the rule needs, and
    // holding exactly the 50-baht minimum: passes today, no room to lose either.
    const member = await createMember({
      villageAreaId: villageOne.villageAreaId,
      totalContribution: 50,
    });
    await prisma.member.update({
      where: { id: member.id },
      data: { approvedDate: new Date(now.getFullYear(), now.getMonth() - 12, 1) },
    });
    for (const monthsAgo of [0, 1, 2, 3, 4, 5]) {
      await prisma.wasteSale.create({
        data: {
          saleNo: `S-${member.id}-${monthsAgo}`,
          memberId: member.id,
          roundId: round.id,
          buyerId: buyer.id,
          saleDate: new Date(now.getFullYear(), now.getMonth() - monthsAgo, 15),
          totalAmount: 100,
          netAmount: 100,
          status: 'completed',
        },
      });
    }

    const report = await getDashboard(villageOne, now);

    expect(report.members.benefitEligible).toBe(1);
    expect(report.members.atRiskCount).toBe(1);
    const atRisk = report.members.atRiskMembers[0]!;
    expect(atRisk.id).toBe(member.id);
    expect(atRisk.activeMonths).toBe(6);
    // Both risks fire: exactly the minimum active months, and a fund that one
    // more funeral contribution would take under the minimum.
    expect(atRisk.reasons).toHaveLength(2);
  });

  it('groups the current round\'s requests by area and counts what is left to plan', async () => {
    const now = new Date();
    const buyer = await prisma.buyer.create({ data: { buyerName: 'ร้านทดสอบ' } });
    const round = await prisma.collectionRound.create({
      data: {
        roundDate: now,
        startTime: '09:00',
        endTime: '23:00',
        buyerId: buyer.id,
        villageAreaId: villageOne.villageAreaId,
        status: 'planned',
      },
    });

    const withPin = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    const withoutPin = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });

    await prisma.saleRequest.create({
      data: {
        memberId: withPin.id,
        roundId: round.id,
        estimatedQuantity: 12,
        status: 'confirmed',
        pickupLat: 13.1,
        pickupLng: 100.9,
      },
    });
    await prisma.saleRequest.create({
      data: {
        memberId: withoutPin.id,
        roundId: round.id,
        estimatedQuantity: 8,
        status: 'confirmed',
      },
    });

    const report = await getDashboard(villageOne, now);

    expect(report.currentRound?.id).toBe(round.id);
    expect(report.currentRound?.requestCount).toBe(2);
    expect(report.currentRound?.plannedRequestCount).toBe(0);
    expect(report.currentRound?.readyToPlanCount).toBe(1);
    expect(report.currentRound?.missingLocationCount).toBe(1);
    expect(report.areaGroups).toEqual([
      { label: 'หมู่ 1', requestCount: 2, memberCount: 2, estimatedQuantity: 20, plannedCount: 0 },
    ]);
  });
});
