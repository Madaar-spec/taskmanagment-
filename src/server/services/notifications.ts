// FR-28: تنبيهات داخل النظام
import { prisma, type Tx } from '../db';
import { notFound } from '../errors';
import type { SessionUser } from '../auth/currentUser';

export async function notify(db: Tx, userId: string, taskId: string, messageAr: string) {
  await db.notification.create({ data: { userId, taskId, messageAr: messageAr.slice(0, 300) } });
}

export async function listNotifications(user: SessionUser) {
  const [items, unread] = await prisma.$transaction([
    prisma.notification.findMany({
      // التنبيهات الخاصة بمهام محذوفة لا تظهر (BR-14)
      where: { userId: user.id, task: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { task: { select: { code: true } } },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null, task: { deletedAt: null } } }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: n.id,
      messageAr: n.messageAr,
      taskCode: n.task.code,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationRead(user: SessionUser, id: string) {
  const res = await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (res.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!exists) throw notFound();
  }
  return { id };
}
