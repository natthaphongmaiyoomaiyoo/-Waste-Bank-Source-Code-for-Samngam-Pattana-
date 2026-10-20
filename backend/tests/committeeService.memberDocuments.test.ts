import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/database/prisma.js';
import {
  addMemberDocument,
  deleteMemberDocument,
} from '../src/services/committeeService.js';
import { reportMemberDeath } from '../src/services/funeralCaseService.js';
import { localBucketDirectory } from '../src/services/storageService.js';
import type { VillageScope } from '../src/middleware/villageScope.js';
import {
  createFundAccount,
  createMember,
  createVillageArea,
  makeMemberFuneralEligible,
} from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

// A committee can remove a wrong or outdated member document - from its own
// village only, and never the death certificate a recorded death relies on.

function pdf(name: string) {
  return {
    originalname: name,
    mimetype: 'application/pdf',
    size: 8,
    buffer: Buffer.from('%PDF-1.4'),
  } as Express.Multer.File;
}

function scopeOf(village: { id: number; villageName: string; moo: string | null }): VillageScope {
  return { villageAreaId: village.id, villageName: village.villageName, moo: village.moo ?? '' };
}

const fileOnDisk = (storagePath: string) => path.join(localBucketDirectory('memberDocuments'), storagePath);
const exists = (file: string) => fs.access(file).then(() => true, () => false);

let villageOne: VillageScope;
let villageTwo: VillageScope;

beforeEach(async () => {
  await resetDb();
  villageOne = scopeOf(await createVillageArea('บ้านหนองน้ำ', '1'));
  villageTwo = scopeOf(await createVillageArea('บ้านโคกสูง', '2'));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('committeeService.deleteMemberDocument', () => {
  it('removes the document row and its stored file', async () => {
    const member = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    const document = await addMemberDocument(member.id, { documentType: 'citizen_id' }, pdf('id-card.pdf'), 1, villageOne);
    const row = await prisma.memberDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect(row.storagePath).toMatch(/^citizen-id\//);
    expect(await exists(fileOnDisk(row.storagePath))).toBe(true);

    await deleteMemberDocument(member.id, document.id, villageOne);

    expect(await prisma.memberDocument.findUnique({ where: { id: document.id } })).toBeNull();
    expect(await exists(fileOnDisk(row.storagePath))).toBe(false);
  });

  it("refuses another village's member and keeps the document", async () => {
    const outsider = await createMember({ villageAreaId: villageTwo.villageAreaId, moo: '2' });
    const document = await addMemberDocument(outsider.id, { documentType: 'other' }, pdf('note.pdf'), 1, villageTwo);

    await expect(deleteMemberDocument(outsider.id, document.id, villageOne)).rejects.toMatchObject({ statusCode: 403 });
    expect(await prisma.memberDocument.findUnique({ where: { id: document.id } })).not.toBeNull();
  });

  it('answers 404 when the document belongs to a different member', async () => {
    const owner = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    const other = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1' });
    const document = await addMemberDocument(owner.id, { documentType: 'other' }, pdf('note.pdf'), 1, villageOne);

    await expect(deleteMemberDocument(other.id, document.id, villageOne)).rejects.toMatchObject({ statusCode: 404 });
    expect(await prisma.memberDocument.findUnique({ where: { id: document.id } })).not.toBeNull();
  });

  it('keeps the death certificate of a death reported and waiting for approval', async () => {
    await createFundAccount(100000);
    const deceased = await createMember({ villageAreaId: villageOne.villageAreaId, moo: '1', totalContribution: 100 });
    await makeMemberFuneralEligible(deceased.id);
    await reportMemberDeath(deceased.id, { deathDate: '2026-07-25', causeOfDeath: 'ทดสอบระบบ' }, pdf('death.pdf'), 1, villageOne);
    const certificate = await prisma.memberDocument.findFirstOrThrow({
      where: { memberId: deceased.id, documentType: 'death_certificate' },
    });

    await expect(deleteMemberDocument(deceased.id, certificate.id, villageOne)).rejects.toMatchObject({ statusCode: 400 });
    expect(await prisma.memberDocument.findUnique({ where: { id: certificate.id } })).not.toBeNull();
    expect(await exists(fileOnDisk(certificate.storagePath))).toBe(true);
  });
});
