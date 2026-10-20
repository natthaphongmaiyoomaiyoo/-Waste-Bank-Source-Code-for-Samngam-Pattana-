import { prisma } from '../database/prisma.js';

const FUNERAL_NOTIFICATION_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;

export async function list(userId: number, now = new Date()) {
  const funeralCutoff = new Date(now.getTime() - FUNERAL_NOTIFICATION_LIFETIME_MS);

  return prisma.notification.findMany({
    where: {
      userId,
      OR: [
        { notificationType: { not: 'funeral' } },
        { notificationType: 'funeral', createdAt: { gte: funeralCutoff } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Scoped to the user, so ids belonging to anyone else are skipped rather than
// marked.
export async function markRead(userId: number, notificationIds: number[]) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, id: { in: notificationIds } },
    data: { isRead: true },
  });
  return { count };
}
