import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';
import {
  ELIGIBILITY_MONTHS_REQUIRED,
  FUND_MINIMUM_BAHT,
  MEMBERSHIP_TENURE_MONTHS_REQUIRED,
} from '../src/config/constants.js';

const SEED_NOTE = 'seed:village-demo';
const MEMBERS_PER_VILLAGE = 10;
const ELIGIBLE_MEMBERS_PER_VILLAGE = 5;
const MEMBER_PASSWORD = 'Member123!';
const COMMITTEE_PASSWORD = 'Committee123!';
const SALE_TOTAL_BAHT = 100;

const firstNames = [
  'สมพร',
  'มาลี',
  'วิชัย',
  'กัลยา',
  'ประเสริฐ',
  'นภา',
  'อนันต์',
  'พิมพ์ใจ',
  'สมศักดิ์',
  'วาสนา',
] as const;

const lastNames = [
  'ใจดี',
  'ศรีสุข',
  'มั่นคง',
  'รุ่งเรือง',
  'แสงทอง',
  'บุญมี',
  'พูนทรัพย์',
  'สุขใจ',
  'อินทร์แก้ว',
  'ทองดี',
] as const;

function monthsAgo(months: number): Date {
  const date = new Date();
  date.setDate(15);
  date.setMonth(date.getMonth() - months);
  date.setHours(9, 0, 0, 0);
  return date;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function citizenIdFor(villageId: number, memberIndex: number): string {
  return `880${String(villageId).padStart(4, '0')}${String(memberIndex).padStart(6, '0')}`;
}

function phoneFor(villageId: number, memberIndex: number): string {
  return `08${String(villageId).padStart(3, '0')}${String(memberIndex).padStart(5, '0')}`;
}

function nextAvailableMemberCode(usedCodes: Set<string>, startingAt: number): string {
  let next = startingAt;
  while (usedCodes.has(String(next).padStart(3, '0'))) next += 1;
  const code = String(next).padStart(3, '0');
  usedCodes.add(code);
  return code;
}

async function ensureVillageRounds(
  tx: Prisma.TransactionClient,
  village: { id: number; villageName: string },
  buyerId: number,
  committeeId: number,
) {
  const rounds = [];

  for (let monthsBack = ELIGIBILITY_MONTHS_REQUIRED - 1; monthsBack >= 0; monthsBack -= 1) {
    const roundDate = monthsAgo(monthsBack);
    const monthStart = new Date(roundDate.getFullYear(), roundDate.getMonth(), 1);
    const nextMonth = new Date(roundDate.getFullYear(), roundDate.getMonth() + 1, 1);
    const locationNote = `${SEED_NOTE}:village-${village.id}`;

    let round = await tx.collectionRound.findFirst({
      where: {
        villageAreaId: village.id,
        locationNote,
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
        locationNote,
        villageAreaId: village.id,
        status: 'completed',
        createdBy: committeeId,
      },
    });

    rounds.push(round);
  }

  return rounds;
}

async function main() {
  const [villages, memberRole, committeeRole, buyer, wasteType, fundAccount] = await Promise.all([
    prisma.villageArea.findMany({
      where: { status: 'active' },
      orderBy: { id: 'asc' },
    }),
    prisma.role.findUnique({ where: { roleName: 'member' } }),
    prisma.role.findUnique({ where: { roleName: 'committee' } }),
    prisma.buyer.findFirst({ orderBy: { id: 'asc' } }),
    prisma.wasteType.findFirst({ orderBy: { id: 'asc' } }),
    prisma.fundAccount.findFirst({ orderBy: { id: 'asc' } }),
  ]);

  if (villages.length === 0) throw new Error('No active villages found');
  if (!memberRole || !committeeRole || !buyer || !wasteType || !fundAccount) {
    throw new Error('Run the main seed first to create roles, buyer, waste type, and fund account');
  }

  const [memberPasswordHash, committeePasswordHash] = await Promise.all([
    bcrypt.hash(MEMBER_PASSWORD, 10),
    bcrypt.hash(COMMITTEE_PASSWORD, 10),
  ]);

  const result = await prisma.$transaction(async (tx) => {
    const existingCommittees = await tx.userAccount.findMany({
      where: { roleId: committeeRole.id },
      orderBy: { id: 'asc' },
    });
    const availableCommittees = existingCommittees.filter(
      (committee) => committee.villageAreaId === null && committee.status === 'active',
    );
    const committeeByVillage = new Map(
      existingCommittees
        .filter((committee) => committee.villageAreaId !== null)
        .map((committee) => [committee.villageAreaId!, committee]),
    );
    const committeeResults: Array<{
      villageId: number;
      villageName: string;
      username: string;
      source: 'existing' | 'assigned' | 'created';
    }> = [];

    for (const village of villages) {
      let committee = committeeByVillage.get(village.id);
      let source: 'existing' | 'assigned' | 'created' = 'existing';

      if (!committee) {
        const available = availableCommittees.shift();
        if (available) {
          committee = await tx.userAccount.update({
            where: { id: available.id },
            data: { villageAreaId: village.id },
          });
          source = 'assigned';
        } else {
          const username = `committee-v${village.id}`;
          committee = await tx.userAccount.upsert({
            where: { username },
            create: {
              username,
              passwordHash: committeePasswordHash,
              fullName: `กรรมการหมู่บ้าน ${village.villageName}`,
              phone: `09${String(village.id).padStart(8, '0')}`,
              roleId: committeeRole.id,
              villageAreaId: village.id,
              status: 'active',
              mustChangePassword: false,
            },
            update: {
              roleId: committeeRole.id,
              villageAreaId: village.id,
              status: 'active',
            },
          });
          source = 'created';
        }
        committeeByVillage.set(village.id, committee);
      }

      committeeResults.push({
        villageId: village.id,
        villageName: village.villageName,
        username: committee.username,
        source,
      });
    }

    const existingMemberCodes = new Set(
      (await tx.member.findMany({ select: { memberCode: true } })).map((member) => member.memberCode),
    );
    let nextCodeNumber = (await tx.member.count()) + 1;
    let runningFundBalance = fundAccount.balance;
    const memberResults: Array<{
      villageId: number;
      villageName: string;
      memberId: number;
      memberCode: string;
      username: string;
      eligible: boolean;
    }> = [];

    for (const village of villages) {
      const committee = committeeByVillage.get(village.id)!;
      const rounds = await ensureVillageRounds(tx, village, buyer.id, committee.id);

      for (let memberIndex = 1; memberIndex <= MEMBERS_PER_VILLAGE; memberIndex += 1) {
        const eligible = memberIndex <= ELIGIBLE_MEMBERS_PER_VILLAGE;
        const citizenId = citizenIdFor(village.id, memberIndex);
        const phone = phoneFor(village.id, memberIndex);
        const prefix = memberIndex % 2 === 0 ? 'นาง' : 'นาย';
        const firstName = firstNames[memberIndex - 1]!;
        const lastName = `${lastNames[memberIndex - 1]!} หมู่ ${village.moo ?? village.id}`;
        const fullName = `${prefix}${firstName} ${lastName}`;
        const approvedDate = eligible
          ? monthsAgo(MEMBERSHIP_TENURE_MONTHS_REQUIRED + 1)
          : new Date();

        let member = await tx.member.findUnique({
          where: { citizenId },
          include: { household: true },
        });

        if (member && member.remark !== SEED_NOTE) {
          throw new Error(`Citizen ID ${citizenId} already belongs to non-seed data`);
        }

        if (!member) {
          const memberCode = nextAvailableMemberCode(existingMemberCodes, nextCodeNumber);
          nextCodeNumber = Number(memberCode) + 1;
          member = await tx.member.create({
            data: {
              memberCode,
              citizenId,
              prefix,
              firstName,
              lastName,
              birthDate: new Date(1980 + memberIndex, memberIndex % 12, 10),
              gender: memberIndex % 2 === 0 ? 'female' : 'male',
              phone,
              occupation: 'สมาชิกชุมชน',
              approvedDate,
              status: 'active',
              remark: SEED_NOTE,
              household: {
                create: {
                  houseNo: `${village.id}/${100 + memberIndex}`,
                  moo: village.moo,
                  subdistrict: village.subdistrict,
                  district: village.district,
                  province: village.province,
                  postcode: village.postcode,
                  villageAreaId: village.id,
                },
              },
              guarantors: {
                create: {
                  guarantorName: `ผู้รับรองหมู่ ${village.moo ?? village.id}`,
                  guarantorPhone: committee.phone,
                  relationship: 'กรรมการหมู่บ้าน',
                  note: SEED_NOTE,
                },
              },
              verifications: {
                create: {
                  ageYears: new Date().getFullYear() - (1980 + memberIndex),
                  ageEligible: true,
                  addressVerified: true,
                  guarantorVerified: true,
                  result: 'passed',
                  note: SEED_NOTE,
                  verifiedBy: committee.id,
                },
              },
              userAccount: {
                create: {
                  username: citizenId,
                  passwordHash: memberPasswordHash,
                  fullName,
                  phone,
                  roleId: memberRole.id,
                  status: 'active',
                  mustChangePassword: false,
                },
              },
            },
            include: { household: true },
          });
        } else {
          member = await tx.member.update({
            where: { id: member.id },
            data: {
              prefix,
              firstName,
              lastName,
              phone,
              approvedDate,
              status: 'active',
              household: {
                update: {
                  moo: village.moo,
                  subdistrict: village.subdistrict,
                  district: village.district,
                  province: village.province,
                  postcode: village.postcode,
                  villageAreaId: village.id,
                },
              },
              userAccount: {
                upsert: {
                  create: {
                    username: citizenId,
                    passwordHash: memberPasswordHash,
                    fullName,
                    phone,
                    roleId: memberRole.id,
                    status: 'active',
                    mustChangePassword: false,
                  },
                  update: {
                    passwordHash: memberPasswordHash,
                    fullName,
                    phone,
                    roleId: memberRole.id,
                    status: 'active',
                    mustChangePassword: false,
                    failedLoginCount: 0,
                    lockedUntil: null,
                  },
                },
              },
            },
            include: { household: true },
          });
        }

        await tx.memberFundBalance.upsert({
          where: { memberId: member.id },
          create: {
            memberId: member.id,
            totalContribution: eligible ? FUND_MINIMUM_BAHT : 0,
            lastContributionDate: eligible
              ? monthsAgo(ELIGIBILITY_MONTHS_REQUIRED - 1)
              : null,
          },
          update: {
            totalContribution: eligible ? FUND_MINIMUM_BAHT : 0,
            lastContributionDate: eligible
              ? monthsAgo(ELIGIBILITY_MONTHS_REQUIRED - 1)
              : null,
          },
        });

        let contributionSaleId: number | null = null;

        if (eligible) {
          for (const [roundIndex, round] of rounds.entries()) {
            const saleDate = new Date(round.roundDate);
            const key = monthKey(saleDate);
            const saleNo = `SEED-V${village.id}-M${memberIndex}-${key}`;
            const receiptNo = `SEED-RC-V${village.id}-M${memberIndex}-${key}`;
            const fundDeductAmount = roundIndex === 0 ? FUND_MINIMUM_BAHT : 0;
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
                recordedBy: committee.id,
                status: 'completed',
              },
              update: {
                memberId: member.id,
                roundId: round.id,
                buyerId: buyer.id,
                saleDate,
                totalAmount: SALE_TOTAL_BAHT,
                fundDeductAmount,
                netAmount,
                recordedBy: committee.id,
                status: 'completed',
              },
            });

            const existingDetail = await tx.wasteSaleDetail.findFirst({
              where: { saleId: sale.id, wasteTypeId: wasteType.id },
            });
            if (existingDetail) {
              await tx.wasteSaleDetail.update({
                where: { id: existingDetail.id },
                data: {
                  quantity,
                  unitPrice: wasteType.defaultPrice,
                  subtotal: SALE_TOTAL_BAHT,
                },
              });
            } else {
              await tx.wasteSaleDetail.create({
                data: {
                  saleId: sale.id,
                  wasteTypeId: wasteType.id,
                  quantity,
                  unitPrice: wasteType.defaultPrice,
                  subtotal: SALE_TOTAL_BAHT,
                },
              });
            }

            await tx.receipt.upsert({
              where: { saleId: sale.id },
              create: {
                receiptNo,
                saleId: sale.id,
                receiptDate: saleDate,
                totalAmount: SALE_TOTAL_BAHT,
                fundAmount: fundDeductAmount,
                paidAmount: netAmount,
                issuedBy: committee.id,
              },
              update: {
                receiptDate: saleDate,
                totalAmount: SALE_TOTAL_BAHT,
                fundAmount: fundDeductAmount,
                paidAmount: netAmount,
                issuedBy: committee.id,
              },
            });

            if (roundIndex === 0) contributionSaleId = sale.id;
          }

          const contribution = await tx.fundTransaction.findFirst({
            where: {
              memberId: member.id,
              transactionType: 'contribution',
              note: SEED_NOTE,
            },
          });
          if (!contribution) {
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
                recordedBy: committee.id,
                note: SEED_NOTE,
              },
            });
          }
        }

        const eligibilityData = eligible
          ? {
              activeMonthCount: ELIGIBILITY_MONTHS_REQUIRED,
              continuousMonthCount: ELIGIBILITY_MONTHS_REQUIRED,
              isEligible: true,
              reason: 'All conditions met',
            }
          : {
              activeMonthCount: 0,
              continuousMonthCount: 0,
              isEligible: false,
              reason: `fund balance below minimum ${FUND_MINIMUM_BAHT} baht; member for only 0/${MEMBERSHIP_TENURE_MONTHS_REQUIRED} months; only 0/${ELIGIBILITY_MONTHS_REQUIRED} active months`,
            };
        const latestCheck = await tx.eligibilityCheck.findFirst({
          where: { memberId: member.id },
          orderBy: { id: 'desc' },
        });
        if (latestCheck) {
          await tx.eligibilityCheck.update({
            where: { id: latestCheck.id },
            data: eligibilityData,
          });
        } else {
          await tx.eligibilityCheck.create({
            data: { memberId: member.id, ...eligibilityData },
          });
        }

        memberResults.push({
          villageId: village.id,
          villageName: village.villageName,
          memberId: member.id,
          memberCode: member.memberCode,
          username: citizenId,
          eligible,
        });
      }
    }

    await tx.fundAccount.update({
      where: { id: fundAccount.id },
      data: { balance: runningFundBalance },
    });

    return { committeeResults, memberResults };
  });

  console.log('Village demo data is ready.');
  console.table(result.committeeResults);
  console.table(
    villages.map((village) => ({
      village: `${village.villageName} (moo ${village.moo ?? '-'})`,
      seededMembers: result.memberResults.filter((member) => member.villageId === village.id).length,
      eligibleMembers: result.memberResults.filter(
        (member) => member.villageId === village.id && member.eligible,
      ).length,
    })),
  );
  console.log(`Seeded member password: ${MEMBER_PASSWORD}`);
  console.log(`Newly created committee password: ${COMMITTEE_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
