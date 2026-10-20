import { prisma } from '../../src/database/prisma.js';

let memberRoleId: number | undefined;

async function ensureMemberRoleId(): Promise<number> {
  if (memberRoleId !== undefined) return memberRoleId;
  const role = await prisma.role.upsert({
    where: { roleName: 'member' },
    update: {},
    create: { roleName: 'member', description: 'member' },
  });
  memberRoleId = role.id;
  return memberRoleId;
}

let counter = 0;
function nextSeq(): number {
  counter += 1;
  return counter;
}

export interface CreateMemberOptions {
  status?: string;
  totalContribution?: number;
  withUserAccount?: boolean;
  // Village the member's household belongs to - the key committee scoping uses.
  villageAreaId?: number;
  // Address text only; scoping ignores it (see villageScopeService).
  moo?: string;
}

export async function createMember(options: CreateMemberOptions = {}) {
  const seq = nextSeq();
  const household = await prisma.household.create({
    data: {
      houseNo: `H-${seq}`,
      ...(options.moo ? { moo: options.moo } : {}),
      ...(options.villageAreaId ? { villageAreaId: options.villageAreaId } : {}),
    },
  });

  return prisma.member.create({
    data: {
      memberCode: `T-${seq}`,
      householdId: household.id,
      citizenId: `9${String(seq).padStart(12, '0')}`,
      firstName: `Test${seq}`,
      lastName: 'Member',
      birthDate: new Date('1990-01-01'),
      phone: `08${String(seq).padStart(8, '0')}`,
      status: options.status ?? 'active',
      fundBalance: {
        create: {
          totalContribution: options.totalContribution ?? 0,
        },
      },
      ...(options.withUserAccount
        ? {
            userAccount: {
              create: {
                username: `test-user-${seq}`,
                passwordHash: 'x',
                fullName: `Test${seq} Member`,
                roleId: await ensureMemberRoleId(),
              },
            },
          }
        : {}),
    },
    include: { fundBalance: true, userAccount: true },
  });
}

export async function createFundAccount(balance = 100000) {
  return prisma.fundAccount.create({ data: { accountName: 'Test Fund', balance } });
}

export async function createVillageArea(villageName: string, moo: string, status = 'active') {
  return prisma.villageArea.create({ data: { villageName, moo, status } });
}

export async function createFuneralCase(deceasedMemberId: number, requiredAmount = 50) {
  return prisma.funeralCase.create({
    data: {
      deceasedMemberId,
      requiredAmount,
      deathDate: new Date(),
      causeOfDeath: 'ทดสอบระบบ',
    },
  });
}

// Six distinct recent months of completed waste sales for `memberId`, plus an
// approvedDate 7 months back - comfortably satisfies
// committeeService.getFuneralEligibility's activeMonthCount >= 6 and
// membershipMonths >= 6 checks (months need not be consecutive; a real waste
// sale needs a buyer + collection round, but not a waste_sale_detail since
// eligibility only reads waste_sale.sale_date).
export async function makeMemberFuneralEligible(memberId: number) {
  const seq = nextSeq();
  const buyer = await prisma.buyer.create({ data: { buyerName: `Test Buyer ${seq}` } });
  const round = await prisma.collectionRound.create({
    data: {
      roundDate: new Date(),
      startTime: '08:00',
      endTime: '10:00',
      buyerId: buyer.id,
      status: 'completed',
    },
  });

  const now = new Date();
  await prisma.member.update({
    where: { id: memberId },
    data: { approvedDate: new Date(now.getFullYear(), now.getMonth() - 7, 1) },
  });
  for (let i = 0; i < 6; i += 1) {
    const saleDate = new Date(now.getFullYear(), now.getMonth() - i, 15);
    await prisma.wasteSale.create({
      data: {
        saleNo: `T-SALE-${seq}-${i}`,
        memberId,
        roundId: round.id,
        buyerId: buyer.id,
        saleDate,
        totalAmount: 100,
        netAmount: 100,
        status: 'completed',
      },
    });
  }
}
