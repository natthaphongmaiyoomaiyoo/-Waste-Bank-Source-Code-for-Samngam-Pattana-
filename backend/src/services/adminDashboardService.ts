import { FUND_MINIMUM_BAHT, MEMBER_STATUS } from '../config/constants.js';
import { prisma } from '../database/prisma.js';

export async function getAdminDashboardSummary() {
  // 1. Total Fund Balance - the fund account already holds every member's savings.
  const fundAccountSum = await prisma.fundAccount.aggregate({
    _sum: { balance: true }
  });
  const totalBalance = fundAccountSum._sum.balance || 0;

  // 2. Total Member Count
  const memberCount = await prisma.member.count();

  // 3. Next Collection Date (upcoming planned round)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const nextRound = await prisma.collectionRound.findFirst({
    where: {
      roundDate: { gte: startOfToday },
      status: 'planned'
    },
    orderBy: { roundDate: 'asc' }
  });

  let nextCollectionDateStr = '-';
  let daysRemaining = 0;
  if (nextRound) {
    const rDate = new Date(nextRound.roundDate);
    const thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const day = rDate.getDate();
    const month = thMonths[rDate.getMonth()];
    const year = rDate.getFullYear() + 543;
    nextCollectionDateStr = `${day} ${month} ${year}`;
    
    const diffTime = rDate.getTime() - startOfToday.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // 4. Low Balance Members (savings under the 50 THB minimum)
  // Join with member and household/village. A deceased or resigned member's
  // account is closed (a death closes the savings out to the heirs), so they
  // have nothing left to top up - same rule as the member pages' shortfall badge.
  const lowFundRecords = await prisma.memberFundBalance.findMany({
    where: {
      totalContribution: { lt: FUND_MINIMUM_BAHT },
      member: { status: { notIn: [MEMBER_STATUS.DECEASED, MEMBER_STATUS.RESIGNED] } },
    },
    take: 10,
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          household: {
            select: { moo: true }
          }
        }
      }
    }
  });

  const lowBalanceMembers = lowFundRecords.map(rec => ({
    id: rec.memberId,
    name: `${rec.member.firstName} ${rec.member.lastName}`.trim(),
    villageId: rec.member.household?.moo ? `หมู่ที่ ${rec.member.household.moo}` : 'ไม่ระบุหมู่บ้าน',
    balance: rec.totalContribution
  }));

  // 5. Purchase Trend for past 6 months (group by month)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const sales = await prisma.wasteSale.findMany({
    where: {
      status: 'completed',
      saleDate: { gte: sixMonthsAgo }
    },
    select: {
      saleDate: true,
      totalAmount: true
    },
    orderBy: { saleDate: 'asc' }
  });

  // Aggregate by YYYY-MM
  const thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthMap: Record<string, number> = {};

  // Initialize last 6 months in order
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = 0;
  }

  sales.forEach(sale => {
    const d = new Date(sale.saleDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap[key] !== undefined) {
      monthMap[key] += sale.totalAmount;
    }
  });

  const chartCategories: string[] = [];
  const chartSeriesData: number[] = [];

  Object.entries(monthMap).forEach(([key, amount]) => {
    const [_y, m] = key.split('-');
    const mIdx = parseInt(m, 10) - 1;
    chartCategories.push(thMonths[mIdx]);
    chartSeriesData.push(Math.round(amount));
  });

  return {
    summary: {
      totalBalance,
      memberCount,
      nextCollectionDate: nextCollectionDateStr,
      daysRemaining
    },
    lowBalanceMembers,
    chartCategories,
    chartSeriesData
  };
}
