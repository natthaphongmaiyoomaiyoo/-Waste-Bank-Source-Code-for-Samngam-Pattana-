import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { list, markRead } from '../src/services/notificationService.js';
import { createMember } from './helpers/fixtures.js';
import { resetDb } from './helpers/resetDb.js';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('notificationService.list', () => {
  it('hides funeral notifications after three days while retaining other notification types', async () => {
    const member = await createMember({ withUserAccount: true });
    const userId = member.userAccount!.id;
    const now = new Date('2026-07-24T12:00:00.000Z');

    await prisma.notification.createMany({
      data: [
        {
          userId,
          title: 'Recent funeral',
          message: 'Recent',
          notificationType: 'funeral',
          createdAt: new Date('2026-07-22T12:00:00.000Z'),
        },
        {
          userId,
          title: 'Expired funeral',
          message: 'Expired',
          notificationType: 'funeral',
          createdAt: new Date('2026-07-20T12:00:00.000Z'),
        },
        {
          userId,
          title: 'Older fund notice',
          message: 'Retained',
          notificationType: 'fund',
          createdAt: new Date('2026-07-20T12:00:00.000Z'),
        },
      ],
    });

    const notifications = await list(userId, now);

    expect(notifications.map((notification) => notification.title)).toEqual([
      'Recent funeral',
      'Older fund notice',
    ]);
  });
});

describe('notificationService.markRead', () => {
  it("marks the user's own notifications read and leaves other users' untouched", async () => {
    const member = await createMember({ withUserAccount: true });
    const other = await createMember({ withUserAccount: true });
    const userId = member.userAccount!.id;
    const otherUserId = other.userAccount!.id;

    const [first, second, untouched, othersNotification] = await Promise.all([
      prisma.notification.create({ data: { userId, title: 'First', message: 'm', notificationType: 'fund' } }),
      prisma.notification.create({ data: { userId, title: 'Second', message: 'm', notificationType: 'fund' } }),
      prisma.notification.create({ data: { userId, title: 'Untouched', message: 'm', notificationType: 'fund' } }),
      prisma.notification.create({
        data: { userId: otherUserId, title: 'Other user', message: 'm', notificationType: 'fund' },
      }),
    ]);

    const result = await markRead(userId, [first.id, second.id, othersNotification.id]);

    expect(result).toEqual({ count: 2 });
    const rows = await prisma.notification.findMany({
      where: { id: { in: [first.id, second.id, untouched.id, othersNotification.id] } },
    });
    const isRead = Object.fromEntries(rows.map((row) => [row.title, row.isRead]));
    expect(isRead).toEqual({ First: true, Second: true, Untouched: false, 'Other user': false });
  });
});
