// Seeds a batch of members who fully qualify to claim money from the funeral
// fund, built the way the real flow builds them: completed waste sales in
// separate months, the 50 baht mandatory contribution deducted from the first
// sale (committeeSellRequestService.recordPurchase does the same), matching
// receipts and one fund_transaction on the shared fund account.
//
// Every condition in eligibilityService.evaluateEligibility ends up satisfied:
//   - fund contribution >= FUND_MINIMUM_BAHT (50)
//   - approved member for >= MEMBERSHIP_TENURE_MONTHS_REQUIRED (6) months
//   - sales in >= ELIGIBILITY_MONTHS_REQUIRED (6) distinct months of the 12-month window
//
// Re-runnable: members are matched by citizen id and sales by sale number, so
// running it twice updates the same rows instead of duplicating them.
//
//   npx tsx scripts/seedEligibleMembers.ts
//   SEED_MEMBER_COUNT=5 SEED_VILLAGE_MOO=2 npx tsx scripts/seedEligibleMembers.ts
//
// SEED_SURPLUS_TO_FUND=1 makes each member keep everything left after the 50
// baht top-up in their savings (the "เก็บเข้าเงินสะสม" amount on the sell
// request) instead of taking it as cash. Seed a second, distinct batch
// by moving the id/name windows along:
//
//   SEED_SURPLUS_TO_FUND=1 SEED_CITIZEN_ID_BASE=2900000000101 SEED_NAME_OFFSET=7 \
//     npx tsx scripts/seedEligibleMembers.ts
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';
import {
  ELIGIBILITY_MONTHS_REQUIRED,
  ELIGIBILITY_WINDOW_MONTHS,
  FUND_MINIMUM_BAHT,
  MEMBERSHIP_TENURE_MONTHS_REQUIRED,
} from '../src/config/constants.js';

const SEED_NOTE = 'seed:eligible-claimant';
const MEMBER_PASSWORD = 'Member123!';
const MEMBER_COUNT = Number(process.env.SEED_MEMBER_COUNT ?? 20);
const VILLAGE_MOO = process.env.SEED_VILLAGE_MOO ?? '1';
// Citizen ids (= login usernames) run from here upwards, one per seeded member.
const CITIZEN_ID_BASE = Number(process.env.SEED_CITIZEN_ID_BASE ?? 2_900_000_000_001);
// Shifts which name/surname pairs this batch draws, so a second batch doesn't
// end up with the same people as the first.
const NAME_OFFSET = Number(process.env.SEED_NAME_OFFSET ?? 0);
// Keep the sale proceeds left over after the 50 baht top-up in savings instead
// of handing them over in cash.
const SURPLUS_TO_FUND = ['1', 'true', 'yes'].includes((process.env.SEED_SURPLUS_TO_FUND ?? '').toLowerCase());

// What each member sells, oldest sale first: one completed sale per amount, one
// month apart, ending last month. The 50 baht fund deduction eats into them in
// order and stops once the minimum is covered, exactly like real purchases - so
// the amounts only have to add up to 50, they don't each have to reach it.
const SALE_PLAN = parseSalePlan(process.env.SEED_SALE_AMOUNTS ?? '30,30,25,25,20,20');

function parseSalePlan(raw: string) {
  const amounts = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  return amounts.map((amount, index) => ({ monthsBack: amounts.length - index, amount }));
}

// Prefix follows the name's gender, so the seeded rows read like real ones.
const people: Array<{ firstName: string; gender: 'male' | 'female' }> = [
  { firstName: 'สมชาย', gender: 'male' },
  { firstName: 'มาลี', gender: 'female' },
  { firstName: 'ประยูร', gender: 'male' },
  { firstName: 'สุดา', gender: 'female' },
  { firstName: 'วิรัตน์', gender: 'male' },
  { firstName: 'ปราณี', gender: 'female' },
  { firstName: 'อนันต์', gender: 'male' },
  { firstName: 'กมลา', gender: 'female' },
  { firstName: 'ธีระ', gender: 'male' },
  { firstName: 'จินตนา', gender: 'female' },
  { firstName: 'บุญมี', gender: 'male' },
  { firstName: 'รัตนา', gender: 'female' },
  { firstName: 'สมพงษ์', gender: 'male' },
  { firstName: 'อารีย์', gender: 'female' },
  { firstName: 'ณรงค์', gender: 'male' },
  { firstName: 'พเยาว์', gender: 'female' },
  { firstName: 'ชูชาติ', gender: 'male' },
  { firstName: 'สมหญิง', gender: 'female' },
  { firstName: 'ไพโรจน์', gender: 'male' },
  { firstName: 'ลำดวน', gender: 'female' },
];
const lastNames = [
  'ใจดี', 'ศรีสุข', 'ทองคำ', 'พูนผล', 'แก้วมณี', 'บุญเรือง', 'สายทอง', 'มั่นคง',
  'เจริญสุข', 'วงศ์ไทย',
];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

// The 15th of the month N months back, at 09:00 - inside the rolling
// eligibility window and unambiguous about which calendar month it lands in.
function monthsAgo(months: number): Date {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - months);
  date.setDate(15);
  date.setHours(9, 0, 0, 0);
  return date;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Running member codes ("035", "036", ...), skipping every code already taken -
// memberService.nextMemberCode counts rows, which collides with the 9xx codes
// older mock scripts inserted.
function makeCodeAllocator(takenCodes: Set<string>) {
  let next = 1;
  return function allocate(): string {
    for (;;) {
      const code = String(next).padStart(3, '0');
      next += 1;
      if (!takenCodes.has(code)) {
        takenCodes.add(code);
        return code;
      }
    }
  };
}

// One completed collection round per sale month, reused if the village already
// has one that month (a sale must hang off a round).
async function ensureRounds(
  tx: Prisma.TransactionClient,
  buyerId: number,
  villageAreaId: number | null,
  createdBy: number | null,
) {
  const rounds = new Map<number, { id: number; roundDate: Date }>();

  for (const { monthsBack } of SALE_PLAN) {
    const roundDate = monthsAgo(monthsBack);
    const monthStart = new Date(roundDate.getFullYear(), roundDate.getMonth(), 1);
    const nextMonth = new Date(roundDate.getFullYear(), roundDate.getMonth() + 1, 1);

    let round = await tx.collectionRound.findFirst({
      where: {
        buyerId,
        status: 'completed',
        ...(villageAreaId ? { villageAreaId } : {}),
        roundDate: { gte: monthStart, lt: nextMonth },
      },
      orderBy: { id: 'asc' },
    });

    round ??= await tx.collectionRound.create({
      data: {
        roundDate,
        startTime: '09:00',
        endTime: '12:00',
        buyerId,
        ...(villageAreaId ? { villageAreaId } : {}),
        locationNote: `รอบรับซื้อ (${SEED_NOTE})`,
        status: 'completed',
        createdBy,
      },
    });

    rounds.set(monthsBack, round);
  }

  return rounds;
}

async function main() {
  const totalSaleBaht = SALE_PLAN.reduce((sum, sale) => sum + sale.amount, 0);
  if (SALE_PLAN.length < ELIGIBILITY_MONTHS_REQUIRED) {
    throw new Error(`SEED_SALE_AMOUNTS must cover at least ${ELIGIBILITY_MONTHS_REQUIRED} distinct months`);
  }
  if (SALE_PLAN[0]!.monthsBack > ELIGIBILITY_WINDOW_MONTHS - 1) {
    throw new Error(
      `The oldest sale would fall outside the ${ELIGIBILITY_WINDOW_MONTHS}-month eligibility window`,
    );
  }
  if (totalSaleBaht < FUND_MINIMUM_BAHT) {
    throw new Error(`The sales must add up to at least ${FUND_MINIMUM_BAHT} baht to reach the fund minimum`);
  }

  const [memberRole, buyer, wasteTypes, fundAccount, village] = await Promise.all([
    prisma.role.findUnique({ where: { roleName: 'member' } }),
    prisma.buyer.findFirst({ orderBy: { id: 'asc' } }),
    prisma.wasteType.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } }),
    prisma.fundAccount.findFirst({ orderBy: { id: 'asc' } }),
    prisma.villageArea.findFirst({ where: { moo: VILLAGE_MOO }, orderBy: { id: 'asc' } }),
  ]);

  if (!memberRole || !buyer || wasteTypes.length === 0 || !fundAccount) {
    throw new Error('กรุณารัน seed หลักก่อน เพื่อสร้าง role, buyer, waste type และ fund account');
  }
  if (!village) {
    throw new Error(`ไม่พบหมู่บ้านของหมู่ที่ ${VILLAGE_MOO} - สร้างหมู่บ้านก่อน หรือระบุ SEED_VILLAGE_MOO ให้ตรง`);
  }

  const committeeUser = await prisma.userAccount.findFirst({
    where: { role: { roleName: 'committee' }, villageAreaId: village.id },
    orderBy: { id: 'asc' },
  });

  const passwordHash = await bcrypt.hash(MEMBER_PASSWORD, 10);
  const existingCodes = new Set(
    (await prisma.member.findMany({ select: { memberCode: true } })).map((member) => member.memberCode),
  );
  const allocateCode = makeCodeAllocator(existingCodes);

  const seeded = await prisma.$transaction(
    async (tx) => {
      const rounds = await ensureRounds(tx, buyer.id, village.id, committeeUser?.id ?? null);
      // Read the balance inside the transaction and apply the total as an
      // increment at the end: the app may be charging the fund (a funeral, a
      // purchase) while this runs, and writing an absolute balance computed
      // before the transaction would silently undo those movements.
      const account = await tx.fundAccount.findUniqueOrThrow({ where: { id: fundAccount.id } });
      let runningFundBalance = account.balance;
      let movedIntoFund = 0;
      const results = [];

      for (let index = 0; index < MEMBER_COUNT; index += 1) {
        const citizenId = String(CITIZEN_ID_BASE + index);
        const person = people[(index + NAME_OFFSET) % people.length]!;
        const { firstName, gender } = person;
        // Alternate นาง / นางสาว so the women aren't all married on paper.
        const prefix =
          gender === 'male' ? 'นาย' : (index + NAME_OFFSET) % 4 === 1 ? 'นาง' : 'นางสาว';
        // Stride 3 through the surnames: shifting NAME_OFFSET then gives every
        // first name a different surname than the previous batch gave it.
        const lastName = lastNames[(index * 3 + NAME_OFFSET) % lastNames.length]!;
        const fullName = `${prefix}${firstName} ${lastName}`;
        const phone = `081${String(index + 1).padStart(7, '0')}`;
        // Approved a month before the tenure requirement, so the member stays
        // eligible even right after a month boundary.
        const approvedDate = monthsAgo(MEMBERSHIP_TENURE_MONTHS_REQUIRED + 1);
        const applyDate = monthsAgo(MEMBERSHIP_TENURE_MONTHS_REQUIRED + 2);

        const existing = await tx.member.findUnique({
          where: { citizenId },
          include: { household: true },
        });

        const memberAccount = {
          username: citizenId,
          passwordHash,
          fullName,
          phone,
          roleId: memberRole.id,
          status: 'active',
          mustChangePassword: false,
        };

        let member;
        if (existing) {
          if (existing.householdId) {
            await tx.household.update({
              where: { id: existing.householdId },
              data: { moo: VILLAGE_MOO, villageAreaId: village.id },
            });
          }
          member = await tx.member.update({
            where: { id: existing.id },
            data: {
              prefix,
              firstName,
              lastName,
              gender,
              phone,
              status: 'active',
              approvedDate,
              remark: SEED_NOTE,
              userAccount: {
                upsert: {
                  create: memberAccount,
                  update: { ...memberAccount, failedLoginCount: 0, lockedUntil: null },
                },
              },
            },
          });
        } else {
          const household = await tx.household.create({
            data: {
              houseNo: `${200 + index}/${VILLAGE_MOO}`,
              moo: VILLAGE_MOO,
              subdistrict: 'สามง่ามพัฒนา',
              district: 'หันคา',
              province: 'ชัยนาท',
              postcode: '17130',
              // Committee permissions resolve against this FK, not the moo text -
              // without it the seeded members are invisible to every committee.
              villageAreaId: village.id,
            },
          });

          member = await tx.member.create({
            data: {
              memberCode: allocateCode(),
              householdId: household.id,
              citizenId,
              prefix,
              firstName,
              lastName,
              // Spread ages between 30 and 49 - inside the 18-70 rule.
              birthDate: new Date(1977 + (index % 20), index % 12, 10),
              gender,
              phone,
              occupation: 'สมาชิกชุมชน',
              applyDate,
              approvedDate,
              status: 'active',
              remark: SEED_NOTE,
              guarantors: {
                create: {
                  guarantorName: 'ผู้รับรองข้อมูลทดสอบ',
                  guarantorPhone: '089-999-9999',
                  relationship: 'ผู้รับรอง',
                  note: SEED_NOTE,
                },
              },
              userAccount: { create: memberAccount },
            },
          });
        }

        // --- The sales themselves ------------------------------------------
        let remainingFundGap = FUND_MINIMUM_BAHT;
        let cashPaid = 0;
        let savingsDeposited = 0;
        // Ledger rows to write once the sales are in place: one per sale that
        // moved money into the fund, so the history reads like the real thing.
        const contributionLegs: Array<{ saleId: number; date: Date; amount: number }> = [];
        const depositLegs: Array<{ saleId: number; date: Date; amount: number }> = [];

        for (const [saleIndex, plan] of SALE_PLAN.entries()) {
          const round = rounds.get(plan.monthsBack)!;
          const saleDate = new Date(round.roundDate);
          const saleNo = `SEED-EL-${member.memberCode}-${monthKey(saleDate)}`;
          const receiptNo = `SEED-EL-RC-${member.memberCode}-${monthKey(saleDate)}`;
          // Same rule as a real purchase: keep topping up until the member's
          // savings reach the 50 baht minimum, then stop.
          const fundDeductAmount = roundMoney(Math.min(plan.amount, remainingFundGap));
          const netAmount = roundMoney(plan.amount - fundDeductAmount);
          remainingFundGap = roundMoney(remainingFundGap - fundDeductAmount);
          // What's left after the top-up either goes home as cash or stays in
          // savings - the member's choice on the sell request
          // (committeeSellRequestService.recordPurchase).
          const surplusDeposit = SURPLUS_TO_FUND ? netAmount : 0;
          const cashThisSale = roundMoney(netAmount - surplusDeposit);
          cashPaid = roundMoney(cashPaid + cashThisSale);
          savingsDeposited = roundMoney(savingsDeposited + surplusDeposit);

          const wasteType = wasteTypes[(index + saleIndex) % wasteTypes.length]!;
          const quantity = roundMoney(plan.amount / wasteType.defaultPrice);

          const sale = await tx.wasteSale.upsert({
            where: { saleNo },
            create: {
              saleNo,
              memberId: member.id,
              roundId: round.id,
              buyerId: buyer.id,
              saleDate,
              totalAmount: plan.amount,
              fundDeductAmount,
              netAmount,
              recordedBy: committeeUser?.id ?? null,
              status: 'completed',
            },
            update: {
              memberId: member.id,
              roundId: round.id,
              buyerId: buyer.id,
              saleDate,
              totalAmount: plan.amount,
              fundDeductAmount,
              netAmount,
              recordedBy: committeeUser?.id ?? null,
              status: 'completed',
            },
          });

          const existingDetail = await tx.wasteSaleDetail.findFirst({
            where: { saleId: sale.id, wasteTypeId: wasteType.id },
          });
          const detailData = {
            quantity,
            unitPrice: wasteType.defaultPrice,
            subtotal: plan.amount,
          };
          if (existingDetail) {
            await tx.wasteSaleDetail.update({ where: { id: existingDetail.id }, data: detailData });
          } else {
            await tx.wasteSaleDetail.create({
              data: { saleId: sale.id, wasteTypeId: wasteType.id, ...detailData },
            });
          }

          await tx.receipt.upsert({
            where: { saleId: sale.id },
            create: {
              receiptNo,
              saleId: sale.id,
              receiptDate: saleDate,
              totalAmount: plan.amount,
              fundAmount: fundDeductAmount,
              paidAmount: cashThisSale,
              issuedBy: committeeUser?.id ?? null,
            },
            update: {
              receiptDate: saleDate,
              totalAmount: plan.amount,
              fundAmount: fundDeductAmount,
              paidAmount: cashThisSale,
              issuedBy: committeeUser?.id ?? null,
            },
          });

          if (fundDeductAmount > 0) {
            contributionLegs.push({ saleId: sale.id, date: saleDate, amount: fundDeductAmount });
          }
          if (surplusDeposit > 0) {
            depositLegs.push({ saleId: sale.id, date: saleDate, amount: surplusDeposit });
          }
        }

        // --- Fund side: balances + ledger rows -------------------------------
        const contributedTotal = roundMoney(
          contributionLegs.reduce((sum, leg) => sum + leg.amount, 0),
        );
        const balanceData = {
          totalContribution: roundMoney(contributedTotal + savingsDeposited),
          lastContributionDate: contributionLegs.at(-1)?.date ?? null,
        };
        await tx.memberFundBalance.upsert({
          where: { memberId: member.id },
          create: { memberId: member.id, ...balanceData },
          update: balanceData,
        });

        // One contribution row per sale that the deduction touched - a member
        // selling small amounts reaches the 50 baht minimum over several sales.
        for (const leg of contributionLegs) {
          const existingContribution = await tx.fundTransaction.findFirst({
            where: { memberId: member.id, saleId: leg.saleId, transactionType: 'contribution' },
          });
          if (existingContribution) continue;

          runningFundBalance = roundMoney(runningFundBalance + leg.amount);
          movedIntoFund = roundMoney(movedIntoFund + leg.amount);
          await tx.fundTransaction.create({
            data: {
              fundAccountId: fundAccount.id,
              memberId: member.id,
              saleId: leg.saleId,
              transactionDate: leg.date,
              transactionType: 'contribution',
              amountIn: leg.amount,
              balanceAfter: runningFundBalance,
              recordedBy: committeeUser?.id ?? null,
              note: `เติมเงินสะสมให้ครบ ${FUND_MINIMUM_BAHT} บาทอัตโนมัติจากยอดขายขยะ - ${SEED_NOTE}`,
            },
          });
        }

        // One deposit row per sale whose surplus the member kept in savings,
        // exactly like a purchase recorded with a "เก็บเข้าเงินสะสม" amount.
        for (const leg of depositLegs) {
          const existingDeposit = await tx.fundTransaction.findFirst({
            where: { memberId: member.id, saleId: leg.saleId, transactionType: 'deposit' },
          });
          if (existingDeposit) continue;

          runningFundBalance = roundMoney(runningFundBalance + leg.amount);
          movedIntoFund = roundMoney(movedIntoFund + leg.amount);
          await tx.fundTransaction.create({
            data: {
              fundAccountId: fundAccount.id,
              memberId: member.id,
              saleId: leg.saleId,
              transactionDate: leg.date,
              transactionType: 'deposit',
              amountIn: leg.amount,
              balanceAfter: runningFundBalance,
              recordedBy: committeeUser?.id ?? null,
              note: `เก็บเงินจากการขายขยะเข้าเงินสะสม - ${SEED_NOTE}`,
            },
          });
        }

        results.push({
          memberCode: member.memberCode,
          name: fullName,
          username: citizenId,
          password: MEMBER_PASSWORD,
          soldBaht: totalSaleBaht,
          fundBaht: contributedTotal,
          savingsBaht: savingsDeposited,
          cashPaid,
          activeMonths: SALE_PLAN.length,
        });
      }

      const updated = await tx.fundAccount.update({
        where: { id: fundAccount.id },
        data: { balance: { increment: movedIntoFund } },
      });

      return { results, fundBalance: updated.balance, movedIntoFund };
    },
    { timeout: 120_000 },
  );

  console.log(
    `สร้าง/อัปเดตสมาชิกที่ครบเงื่อนไขขอรับเงินกองทุน ${seeded.results.length} คน ` +
      `(หมู่ ${VILLAGE_MOO} - ${village.villageName})`,
  );
  console.table(seeded.results);
  console.log(
    `เงินเข้ากองทุนจากรอบนี้ ${seeded.movedIntoFund.toLocaleString()} บาท ` +
      `- ยอดกองทุนล่าสุด ${seeded.fundBalance.toLocaleString()} บาท`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
