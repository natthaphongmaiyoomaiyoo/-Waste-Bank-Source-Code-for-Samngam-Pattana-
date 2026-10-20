import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import {
  cancelMember,
  createMember as committeeCreateMember,
  getMemberDetail,
  getMembersSummary,
  listMembers,
  updateMember,
} from '../src/services/committeeService.js';
import { reportMemberDeath } from '../src/services/funeralCaseService.js';
import type { VillageScope } from '../src/middleware/villageScope.js';
import {
  createFundAccount,
  createMember,
  createVillageArea,
  makeMemberFuneralEligible,
} from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// A village committee must only ever reach members of its own village, even
// when it hand-crafts a request carrying another village's member id.
//
// Scoping keys off household.villageAreaId (a real FK), never the `moo` text -
// see the "renaming a moo" and "two villages, same moo" cases below.

const listQuery = { page: 1, pageSize: 20 };

const deathCertificate = {
  filename: 'death-cert-scope.pdf',
  originalname: 'death-cert.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  buffer: Buffer.from('test-death-certificate'),
} as Express.Multer.File;

let villageOne: VillageScope;
let villageTwo: VillageScope;

function scopeOf(village: { id: number; villageName: string; moo: string | null }): VillageScope {
  return { villageAreaId: village.id, villageName: village.villageName, moo: village.moo ?? '' };
}

// committeeService.createMember connects the new login account to the 'member'
// role by name, so that reference row has to exist.
async function ensureMemberRole() {
  await prisma.role.upsert({
    where: { roleName: 'member' },
    update: {},
    create: { roleName: 'member', description: 'member' },
  });
}

beforeEach(async () => {
  await resetDb();
  villageOne = scopeOf(await createVillageArea('บ้านหนองน้ำ', '1'));
  villageTwo = scopeOf(await createVillageArea('บ้านโคกสูง', '2'));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('committee village scope', () => {
  it("lists and counts only members of the committee's own village", async () => {
    await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    await createMember({ villageAreaId: villageTwo.villageAreaId, moo: '2' });

    const ownVillage = await listMembers(listQuery, villageOne);
    expect(ownVillage.total).toBe(2);
    expect(
      ownVillage.items.every((member) => member.household.villageAreaId === villageOne.villageAreaId),
    ).toBe(true);

    expect((await listMembers(listQuery, villageTwo)).total).toBe(1);

    // Admin (null scope) still sees everyone.
    expect((await listMembers(listQuery, null)).total).toBe(3);

    expect((await getMembersSummary(villageOne)).total).toBe(2);
  });

  it('never exposes a member whose household is not linked to any village', async () => {
    await createMember({ moo: '1' });

    // Same moo text as village one, but no FK - nobody owns it but the admin.
    expect((await listMembers(listQuery, villageOne)).total).toBe(0);
    expect((await listMembers(listQuery, null)).total).toBe(1);
  });

  it('keeps permissions intact when two villages share a moo, or a moo is renamed', async () => {
    const twin = scopeOf(await createVillageArea('บ้านหนองน้ำใต้', '1'));
    const mine = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    const theirs = await createMember({ villageAreaId: twin.villageAreaId, moo: '1' });

    // Identical moo, still two separate villages.
    expect((await listMembers(listQuery, villageOne)).items.map((m) => m.id)).toEqual([mine.id]);
    expect((await listMembers(listQuery, twin)).items.map((m) => m.id)).toEqual([theirs.id]);
    await expect(getMemberDetail(theirs.id, villageOne)).rejects.toMatchObject({ statusCode: 403 });

    // Renaming the moo text does not hand the member to anyone else.
    await prisma.household.updateMany({
      where: { members: { some: { id: mine.id } } },
      data: { moo: '99' },
    });
    expect((await listMembers(listQuery, villageOne)).items.map((m) => m.id)).toEqual([mine.id]);
  });

  it('refuses to read or act on a member from another village', async () => {
    const outsider = await createMember({ villageAreaId: villageTwo.villageAreaId, moo: '2' });

    await expect(getMemberDetail(outsider.id, villageOne)).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      updateMember(outsider.id, { phone: '0800000000' }, villageOne),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(cancelMember(outsider.id, villageOne)).rejects.toMatchObject({ statusCode: 403 });

    // ...while the village's own committee can.
    const insider = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    await expect(getMemberDetail(insider.id, villageOne)).resolves.toMatchObject({ id: insider.id });
  });

  it('refuses to mark a member of another village deceased', async () => {
    await createFundAccount(100000);
    const outsider = await createMember({
      villageAreaId: villageTwo.villageAreaId,
      moo: '2',
      totalContribution: 100,
    });
    await makeMemberFuneralEligible(outsider.id);

    await expect(
      reportMemberDeath(
        outsider.id,
        { deathDate: '2026-07-25', causeOfDeath: 'ทดสอบระบบ' },
        deathCertificate,
        1,
        villageOne,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect((await prisma.member.findUnique({ where: { id: outsider.id } }))?.status).toBe('active');
  });

  it("pins a new member to the committee's village and rejects a foreign moo", async () => {
    await ensureMemberRole();
    const baseInput = {
      citizenId: '1100000009001',
      firstName: 'สมชาย',
      lastName: 'ทดสอบ',
      birthDate: '1990-01-01',
      phone: '0800000001',
    };

    // A blank moo is filled in from the committee's own village, and the
    // household is bound to it by FK.
    const created = await committeeCreateMember(
      { ...baseInput, address: { houseNo: '9/1' } },
      villageOne,
    );
    expect(created.household.moo).toBe('1');
    expect(created.household.villageAreaId).toBe(villageOne.villageAreaId);

    await expect(
      committeeCreateMember(
        { ...baseInput, citizenId: '1100000009002', address: { houseNo: '9/2', moo: '2' } },
        villageOne,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses to move an existing member into another village by editing the address', async () => {
    const member = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });

    await expect(updateMember(member.id, { address: { moo: '2' } }, villageOne)).rejects.toMatchObject(
      { statusCode: 403 },
    );

    const unchanged = await prisma.household.findFirstOrThrow({
      where: { members: { some: { id: member.id } } },
    });
    expect(unchanged.moo).toBe('1');
    expect(unchanged.villageAreaId).toBe(villageOne.villageAreaId);
  });
});
