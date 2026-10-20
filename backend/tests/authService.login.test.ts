import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import * as authService from '../src/services/authService.js';
import { resetDb } from './helpers/resetDb.js';

describe('authService.login', () => {
  beforeEach(resetDb);

  it('does not lock an account after repeated invalid passwords', async () => {
    const role = await prisma.role.upsert({
      where: { roleName: 'admin' },
      update: {},
      create: { roleName: 'admin', description: 'Administrator' },
    });
    const account = await prisma.userAccount.create({
      data: {
        username: 'no-lock-user',
        passwordHash: await bcrypt.hash('Correct123!', 10),
        fullName: 'No Lock User',
        roleId: role.id,
        status: 'active',
      },
    });

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await expect(
        authService.login({ identifier: account.username, password: 'Wrong123!' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    }

    const afterFailures = await prisma.userAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(afterFailures.failedLoginCount).toBe(0);
    expect(afterFailures.lockedUntil).toBeNull();

    const result = await authService.login({
      identifier: account.username,
      password: 'Correct123!',
    });
    expect(result.user.username).toBe(account.username);
  });
});
