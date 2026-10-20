// Test-data helper: brings every ACTIVE member up to all three funeral-fund
// eligibility conditions (eligibilityService.evaluateEligibility), so a death
// can be recorded for anyone and every payer has savings to be charged from.
//
//   npx tsx scripts/makeAllMembersFuneralEligible.ts [targetSavings] [--dry-run]
//
// targetSavings defaults to 500 baht: each death takes FUND_MINIMUM_BAHT (50)
// from every other active member, so 500 leaves room for nine deaths before
// anyone falls under the minimum again. Re-run it whenever tests drain savings.
//
// Per member, only what is missing gets written:
// - tenure:   approvedDate moved back to MEMBERSHIP_TENURE_MONTHS_REQUIRED + 1 months ago
// - activity: a completed 100-baht sale (+ receipt) in each of the previous
//             ELIGIBILITY_MONTHS_REQUIRED calendar months that has none, on an
//             existing completed round of the member's village (saleNo SL-YYYYMM-M<code>)
// - savings:  an "adjustment" ledger row topping the balance up to the target,
//             added to the fund account balance like any other savings inflow
// Afterwards every active member gets a fresh eligibility_check snapshot row.
import { prisma } from '../src/database/prisma.js';
import {
  ELIGIBILITY_MONTHS_REQUIRED,
  FUND_TRANSACTION_TYPE,
  MEMBER_STATUS,
  MEMBERSHIP_TENURE_MONTHS_REQUIRED,
} from '../src/config/constants.js';
import {
  checkMemberEligibility,
  evaluateMembersEligibility,
  monthKey,
} from '../src/services/eligibilityService.js';

const MOCK_TAG = 'mock:funeral-eligible-all';
const SALE_TOTAL_BAHT = 100;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetSavings = Number(args.find((arg) => !arg.startsWith('--')) ?? 500);
if (!Number.isFinite(targetSavings) || targetSavings < 50) {
  throw new Error('targetSavings must be a number >= 50');
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthsAgo(months: number, day = 10): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months, day, 9, 0, 0, 0);
}

async function main() {
  const now = new Date();
  const [fundAccount, wasteType] = await Promise.all([
    prisma.fundAccount.findFirst({ orderBy: { id: 'asc' } }),
    prisma.wasteType.findFirst({ where: { status: 'active' }, orderBy: { id: 'asc' } }),
  ]);
  if (!fundAccount || !wasteType) throw new Error('Fund account / waste type missing - run the main seed first');

  const members = await prisma.member.findMany({
    where: { status: MEMBER_STATUS.ACTIVE },
    select: {
      id: true,
      memberCode: true,
      firstName: true,
      lastName: true,
      approvedDate: true,
      fundBalance: { select: { totalContribution: true } },
      household: { select: { villageAreaId: true } },
    },
    orderBy: { memberCode: 'asc' },
  });
  const before = await evaluateMembersEligibility(members, now);

  // Previous N full calendar months (the current month is left alone).
  const saleMonths = Array.from({ length: ELIGIBILITY_MONTHS_REQUIRED }, (_, i) => monthsAgo(i + 1));
  const existingSales = await prisma.wasteSale.findMany({
    where: { memberId: { in: members.map((m) => m.id) }, status: 'completed', saleDate: { gte: monthsAgo(ELIGIBILITY_MONTHS_REQUIRED, 1) } },
    select: { memberId: true, saleDate: true },
  });
  const soldMonths = new Map<number, Set<string>>();
  for (const sale of existingSales) {
    const keys = soldMonths.get(sale.memberId) ?? new Set<string>();
    keys.add(monthKey(sale.saleDate));
    soldMonths.set(sale.memberId, keys);
  }

  const tenureFixes: typeof members = [];
  const saleFixes: Array<{ member: (typeof members)[number]; month: Date }> = [];
  const topUps: Array<{ member: (typeof members)[number]; from: number; amount: number }> = [];

  for (const member of members) {
    const evaluation = before.get(member.id)!;
    if (!evaluation.membershipAgeCheck.passed) tenureFixes.push(member);
    if (!evaluation.wasteSaleActivityCheck.passed) {
      for (const month of saleMonths) {
        if (!soldMonths.get(member.id)?.has(monthKey(month))) saleFixes.push({ member, month });
      }
    }
    const balance = member.fundBalance?.totalContribution ?? 0;
    if (balance < targetSavings) topUps.push({ member, from: balance, amount: roundMoney(targetSavings - balance) });
  }

  // The round each missing sale goes on: a completed round of the member's
  // village in that month (the one most sales already use), else a
  // municipality-wide one. No round at all -> reported, not invented.
  const roundCache = new Map<string, { id: number; roundDate: Date; buyerId: number; createdBy: number | null } | null>();
  async function roundFor(villageAreaId: number | null, month: Date) {
    const key = `${villageAreaId}:${monthKey(month)}`;
    if (!roundCache.has(key)) {
      const rounds = await prisma.collectionRound.findMany({
        where: {
          status: 'completed',
          roundDate: { gte: new Date(month.getFullYear(), month.getMonth(), 1), lt: new Date(month.getFullYear(), month.getMonth() + 1, 1) },
          OR: [{ villageAreaId }, { villageAreaId: null }],
        },
        select: { id: true, roundDate: true, buyerId: true, createdBy: true, villageAreaId: true, _count: { select: { wasteSales: true } } },
      });
      rounds.sort((a, b) => Number(b.villageAreaId === villageAreaId) - Number(a.villageAreaId === villageAreaId) || b._count.wasteSales - a._count.wasteSales);
      roundCache.set(key, rounds[0] ?? null);
    }
    return roundCache.get(key)!;
  }
  const plannedSales = [];
  const missingRounds: string[] = [];
  for (const fix of saleFixes) {
    const round = await roundFor(fix.member.household?.villageAreaId ?? null, fix.month);
    if (round) plannedSales.push({ ...fix, round });
    else missingRounds.push(`${fix.member.memberCode} ${monthKey(fix.month)}`);
  }

  const totalTopUp = roundMoney(topUps.reduce((sum, t) => sum + t.amount, 0));
  console.log(`${dryRun ? '[dry-run] ' : ''}active members: ${members.length}, eligible before: ${[...before.values()].filter((e) => e.eligible).length}`);
  console.log(`tenure fixes: ${tenureFixes.map((m) => m.memberCode).join(', ') || '-'}`);
  console.log(`mock sales to add: ${plannedSales.length} (${[...new Set(plannedSales.map((s) => s.member.memberCode))].join(', ') || '-'})`);
  if (missingRounds.length) console.log(`!! no completed round for: ${missingRounds.join(', ')} - those members will still fail activity`);
  console.log(`savings top-ups to ${targetSavings} baht: ${topUps.length} members, ${totalTopUp} baht total; fund account ${fundAccount.balance} -> ${roundMoney(fundAccount.balance + totalTopUp)}`);
  if (dryRun) return;

  await prisma.$transaction(
    async (tx) => {
      for (const member of tenureFixes) {
        await tx.member.update({ where: { id: member.id }, data: { approvedDate: monthsAgo(MEMBERSHIP_TENURE_MONTHS_REQUIRED + 1) } });
      }

      for (const { member, month, round } of plannedSales) {
        const key = `${month.getFullYear()}${String(month.getMonth() + 1).padStart(2, '0')}`;
        const sale = await tx.wasteSale.create({
          data: {
            saleNo: `SL-${key}-M${member.memberCode}`,
            memberId: member.id,
            roundId: round.id,
            buyerId: round.buyerId,
            saleDate: round.roundDate,
            totalAmount: SALE_TOTAL_BAHT,
            fundDeductAmount: 0,
            netAmount: SALE_TOTAL_BAHT,
            recordedBy: round.createdBy,
            status: 'completed',
            details: {
              create: {
                wasteTypeId: wasteType.id,
                quantity: roundMoney(SALE_TOTAL_BAHT / wasteType.defaultPrice),
                unitPrice: wasteType.defaultPrice,
                subtotal: SALE_TOTAL_BAHT,
              },
            },
          },
        });
        await tx.receipt.create({
          data: {
            receiptNo: `RC-${key}-M${member.memberCode}`,
            saleId: sale.id,
            receiptDate: round.roundDate,
            totalAmount: SALE_TOTAL_BAHT,
            fundAmount: 0,
            paidAmount: SALE_TOTAL_BAHT,
            issuedBy: round.createdBy,
          },
        });
      }

      let runningBalance = fundAccount.balance;
      if (topUps.length) {
        await tx.fundTransaction.createMany({
          data: topUps.map((topUp) => {
            runningBalance = roundMoney(runningBalance + topUp.amount);
            return {
              fundAccountId: fundAccount.id,
              memberId: topUp.member.id,
              transactionDate: now,
              transactionType: FUND_TRANSACTION_TYPE.ADJUSTMENT,
              amountIn: topUp.amount,
              balanceAfter: runningBalance,
              note: `ข้อมูลทดสอบ: เติมเงินสะสมเป็น ${targetSavings} บาท ให้ผ่านเงื่อนไขฌาปนกิจ (${MOCK_TAG})`,
            };
          }),
        });
        for (const topUp of topUps) {
          await tx.memberFundBalance.upsert({
            where: { memberId: topUp.member.id },
            update: { totalContribution: targetSavings, lastContributionDate: now },
            create: { memberId: topUp.member.id, totalContribution: targetSavings, lastContributionDate: now },
          });
        }
        await tx.fundAccount.update({ where: { id: fundAccount.id }, data: { balance: runningBalance } });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  // Fresh snapshot rows (same as the admin "check eligibility" action) so pages
  // showing the latest check don't keep an older failing result.
  const after = [];
  for (const member of members) {
    after.push({ member, result: await checkMemberEligibility(member.id, { now: new Date() }) });
  }
  const stillFailing = after.filter((a) => !a.result.eligible);
  console.log(`eligible after: ${after.length - stillFailing.length} / ${after.length}`);
  for (const { member, result } of stillFailing) {
    console.log(`  still failing ${member.memberCode} ${member.firstName}: ${result.reason.join('; ')}`);
  }
  console.log(`tenure now (min): ${Math.min(...after.map((a) => a.result.membershipMonths))} months; ` +
    `active months (min): ${Math.min(...after.map((a) => a.result.activeMonthCount))}; ` +
    `savings (min): ${Math.min(...after.map((a) => a.result.fundCheck.amount))} baht`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
