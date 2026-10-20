import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { createMember } from '../src/services/committeeService.js';
import { resetDb } from './helpers/resetDb.js';

// The password the committee hands the member (their own choice, or the citizen
// ID default) is the member's real password: the account must never be flagged
// mustChangePassword, or the member lands on the "set a new password" screen
// instead of their dashboard.

const baseInput = {
  citizenId: '1100000077001',
  firstName: 'สำราญ',
  lastName: 'ทดสอบ',
  birthDate: '1990-01-01',
  phone: '0800000077',
  address: { houseNo: '77/1', moo: '7' },
};

async function accountOf(memberId: number) {
  return prisma.userAccount.findUniqueOrThrow({ where: { memberId } });
}

beforeEach(async () => {
  await resetDb();
  await prisma.role.upsert({
    where: { roleName: 'member' },
    update: {},
    create: { roleName: 'member', description: 'member' },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('committeeService.createMember - login account', () => {
  it('lets the member log in with the citizen-ID default, without a forced password change', async () => {
    const member = await createMember(baseInput, null);
    const account = await accountOf(member.id);

    expect(account.username).toBe(baseInput.citizenId);
    expect(account.mustChangePassword).toBe(false);
    expect(await bcrypt.compare(baseInput.citizenId, account.passwordHash)).toBe(true);
  });

  it('uses the password the committee typed as-is, without a forced password change', async () => {
    const member = await createMember({ ...baseInput, password: 'ChosenPass123!' }, null);
    const account = await accountOf(member.id);

    expect(account.mustChangePassword).toBe(false);
    expect(await bcrypt.compare('ChosenPass123!', account.passwordHash)).toBe(true);
  });
});
