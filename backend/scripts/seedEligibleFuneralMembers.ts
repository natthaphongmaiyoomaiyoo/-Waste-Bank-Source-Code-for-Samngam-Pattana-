import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';
import {
  ELIGIBILITY_MONTHS_REQUIRED,
  FUND_MINIMUM_BAHT,
} from '../src/config/constants.js';

const MOCK_NOTE = 'mock:funeral-eligible';
const SALE_TOTAL_BAHT = 100;

const mockMembers = [
  {
    memberCode: '901',
    citizenId: '1900000000001',
    prefix: 'นาย',
    firstName: 'ประชา',
    lastName: 'ทดสอบสิทธิ์',
    gender: 'male',
    phone: '089-000-0001',
  },
  {
    memberCode: '902',
    citizenId: '1900000000002',
    prefix: 'นาง',
    firstName: 'มาลี',
    lastName: 'ทดสอบสิทธิ์',
    gender: 'female',
    phone: '089-000-0002',
  },
  {
    memberCode: '903',
    citizenId: '1900000000003',
    prefix: 'นาย',
    firstName: 'สมพร',
    lastName: 'ทดสอบสิทธิ์',
    gender: 'male',
    phone: '089-000-0003',
  },
  {
    memberCode: '904',
    citizenId: '1900000000004',
    prefix: 'นางสาว',
    firstName: 'กัลยา',
    lastName: 'ทดสอบสิทธิ์',
    gender: 'female',
    phone: '089-000-0004',
  },
  {
    memberCode: '905',
    citizenId: '1900000000005',
    prefix: 'นาย',
    firstName: 'วิชัย',
    lastName: 'ทดสอบสิทธิ์',
    gender: 'male',
    phone: '089-000-0005',
  },
] as const;

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

async function ensureCompletedRounds(
  tx: Prisma.TransactionClient,
  buyerId: number,
  createdBy: number | null,
) {
  const rounds = [];

  for (let monthsBack = ELIGIBILITY_MONTHS_REQUIRED - 1; monthsBack >= 0; monthsBack -= 1) {
    const roundDate = monthsAgo(monthsBack);
    const monthStart = new Date(roundDate.getFullYear(), roundDate.getMonth(), 1);
    const nextMonth = new Date(roundDate.getFullYear(), roundDate.getMonth() + 1, 1);
    let round = await tx.collectionRound.findFirst({
      where: {
        buyerId,
        status: 'completed',
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
        locationNote: 'รอบจำลองสำหรับทดสอบสิทธิ์ฌาปนกิจ',
        status: 'completed',
        createdBy,
      },
    });
    rounds.push(round);
  }

  return rounds;
}

async function main() {
  const [memberRole, buyer, wasteType, committeeUser, fundAccount, villageMoo1] = await Promise.all([
    prisma.role.findUnique({ where: { roleName: 'member' } }),
    prisma.buyer.findFirst({ orderBy: { id: 'asc' } }),
    prisma.wasteType.findFirst({ orderBy: { id: 'asc' } }),
    prisma.userAccount.findFirst({
      where: { role: { roleName: 'committee' } },
      orderBy: { id: 'asc' },
    }),
    prisma.fundAccount.findFirst({ orderBy: { id: 'asc' } }),
    prisma.villageArea.findFirst({ where: { moo: '1' }, orderBy: { id: 'asc' } }),
  ]);

  if (!memberRole || !buyer || !wasteType || !fundAccount) {
    throw new Error('กรุณารัน seed หลักก่อน เพื่อสร้าง role, buyer, waste type และ fund account');
  }

  const passwordHash = await bcrypt.hash('Member123!', 10);

  const results = await prisma.$transaction(async (tx) => {
    const rounds = await ensureCompletedRounds(tx, buyer.id, committeeUser?.id ?? null);
    let runningFundBalance = fundAccount.balance;
    const seededMembers = [];

    for (const [memberIndex, mock] of mockMembers.entries()) {
      let member = await tx.member.findUnique({ where: { citizenId: mock.citizenId } });

      if (!member) {
        const household = await tx.household.create({
          data: {
            houseNo: String(901 + memberIndex),
            moo: '1',
            subdistrict: 'สามง่ามพัฒนา',
            district: 'หันคา',
            province: 'ชัยนาท',
            postcode: '17130',
            // Committee permissions resolve against this FK, not the moo text -
            // without it these mock members are invisible to every committee.
            ...(villageMoo1 ? { villageAreaId: villageMoo1.id } : {}),
          },
        });

        member = await tx.member.create({
          data: {
            memberCode: mock.memberCode,
            householdId: household.id,
            citizenId: mock.citizenId,
            prefix: mock.prefix,
            firstName: mock.firstName,
            lastName: mock.lastName,
            birthDate: new Date('1985-01-15'),
            gender: mock.gender,
            phone: mock.phone,
            occupation: 'ผู้ทดสอบระบบ',
            approvedDate: monthsAgo(ELIGIBILITY_MONTHS_REQUIRED),
            status: 'active',
            remark: MOCK_NOTE,
            guarantors: {
              create: {
                guarantorName: 'ผู้รับรองข้อมูลทดสอบ',
                guarantorPhone: '089-999-9999',
                relationship: 'ผู้รับรอง',
                note: MOCK_NOTE,
              },
            },
            userAccount: {
              create: {
                username: mock.citizenId,
                passwordHash,
                mustChangePassword: false,
                fullName: `${mock.prefix}${mock.firstName} ${mock.lastName}`,
                phone: mock.phone,
                roleId: memberRole.id,
                status: 'active',
              },
            },
          },
        });
      } else {
        member = await tx.member.update({
          where: { id: member.id },
          data: {
            memberCode: mock.memberCode,
            prefix: mock.prefix,
            firstName: mock.firstName,
            lastName: mock.lastName,
            phone: mock.phone,
            status: 'active',
            approvedDate: member.approvedDate ?? monthsAgo(ELIGIBILITY_MONTHS_REQUIRED),
            remark: MOCK_NOTE,
            userAccount: {
              upsert: {
                create: {
                  username: mock.citizenId,
                  passwordHash,
                  mustChangePassword: false,
                  fullName: `${mock.prefix}${mock.firstName} ${mock.lastName}`,
                  phone: mock.phone,
                  roleId: memberRole.id,
                  status: 'active',
                },
                update: {
                  passwordHash,
                  mustChangePassword: false,
                  fullName: `${mock.prefix}${mock.firstName} ${mock.lastName}`,
                  phone: mock.phone,
                  roleId: memberRole.id,
                  status: 'active',
                },
              },
            },
          },
        });
      }

      let contributionSaleId: number | undefined;

      for (const [saleIndex, round] of rounds.entries()) {
        const saleDate = new Date(round.roundDate);
        const key = monthKey(saleDate);
        const saleNo = `MOCK-FUN-${mock.memberCode}-${key}`;
        const receiptNo = `MOCK-RC-${mock.memberCode}-${key}`;
        const fundDeductAmount = saleIndex === 0 ? FUND_MINIMUM_BAHT : 0;
        const netAmount = SALE_TOTAL_BAHT - fundDeductAmount;
        const quantity = SALE_TOTAL_BAHT / wasteType.defaultPrice;

        const sale = await tx.wasteSale.upsert({
          where: { saleNo },
          create: {
            saleNo,
            memberId: member.id,
            roundId: round.id,
            buyerId: buyer.id,
            saleDate,
            totalAmount: SALE_TOTAL_BAHT,
            fundDeductAmount,
            netAmount,
            recordedBy: committeeUser?.id,
            status: 'completed',
            details: {
              create: {
                wasteTypeId: wasteType.id,
                quantity,
                unitPrice: wasteType.defaultPrice,
                subtotal: SALE_TOTAL_BAHT,
              },
            },
          },
          update: {
            memberId: member.id,
            roundId: round.id,
            buyerId: buyer.id,
            saleDate,
            totalAmount: SALE_TOTAL_BAHT,
            fundDeductAmount,
            netAmount,
            recordedBy: committeeUser?.id,
            status: 'completed',
          },
        });

        await tx.receipt.upsert({
          where: { saleId: sale.id },
          create: {
            receiptNo,
            saleId: sale.id,
            receiptDate: saleDate,
            totalAmount: SALE_TOTAL_BAHT,
            fundAmount: fundDeductAmount,
            paidAmount: netAmount,
            issuedBy: committeeUser?.id,
          },
          update: {
            receiptDate: saleDate,
            totalAmount: SALE_TOTAL_BAHT,
            fundAmount: fundDeductAmount,
            paidAmount: netAmount,
            issuedBy: committeeUser?.id,
          },
        });

        if (saleIndex === 0) contributionSaleId = sale.id;
      }

      await tx.memberFundBalance.upsert({
        where: { memberId: member.id },
        create: {
          memberId: member.id,
          totalContribution: FUND_MINIMUM_BAHT,
          lastContributionDate: monthsAgo(ELIGIBILITY_MONTHS_REQUIRED - 1),
        },
        update: {
          totalContribution: FUND_MINIMUM_BAHT,
          lastContributionDate: monthsAgo(ELIGIBILITY_MONTHS_REQUIRED - 1),
        },
      });

      const existingContribution = await tx.fundTransaction.findFirst({
        where: {
          fundAccountId: fundAccount.id,
          memberId: member.id,
          transactionType: 'contribution',
          note: MOCK_NOTE,
        },
      });

      if (!existingContribution) {
        runningFundBalance += FUND_MINIMUM_BAHT;
        await tx.fundTransaction.create({
          data: {
            fundAccountId: fundAccount.id,
            memberId: member.id,
            saleId: contributionSaleId,
            transactionDate: monthsAgo(ELIGIBILITY_MONTHS_REQUIRED - 1),
            transactionType: 'contribution',
            amountIn: FUND_MINIMUM_BAHT,
            balanceAfter: runningFundBalance,
            recordedBy: committeeUser?.id,
            note: MOCK_NOTE,
          },
        });
      }

      const existingEligibility = await tx.eligibilityCheck.findFirst({
        where: { memberId: member.id },
        orderBy: { id: 'desc' },
      });
      const eligibilityData = {
        activeMonthCount: ELIGIBILITY_MONTHS_REQUIRED,
        continuousMonthCount: ELIGIBILITY_MONTHS_REQUIRED,
        isEligible: true,
        reason: 'All conditions met',
      };

      if (existingEligibility) {
        await tx.eligibilityCheck.update({
          where: { id: existingEligibility.id },
          data: eligibilityData,
        });
      } else {
        await tx.eligibilityCheck.create({
          data: { memberId: member.id, ...eligibilityData },
        });
      }

      seededMembers.push({
        memberId: member.id,
        memberCode: member.memberCode,
        citizenId: member.citizenId,
      });
    }

    await tx.fundAccount.update({
      where: { id: fundAccount.id },
      data: { balance: runningFundBalance },
    });

    return seededMembers;
  });

  console.log('สร้างสมาชิกจำลองที่ผ่านสิทธิ์ฌาปนกิจครบแล้ว');
  console.table(
    results.map((member) => ({
      memberCode: member.memberCode,
      username: member.citizenId,
      password: 'Member123!',
      fundBaht: FUND_MINIMUM_BAHT,
      activeMonths: ELIGIBILITY_MONTHS_REQUIRED,
      continuousMonths: ELIGIBILITY_MONTHS_REQUIRED,
    })),
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
