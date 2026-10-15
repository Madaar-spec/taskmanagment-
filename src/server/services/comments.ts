// FR-10: التعليقات — BR-15 (Append-only)، BR-17
import { commentSchema } from '@/lib/schemas';
import type { SessionUser } from '../auth/currentUser';
import { prisma } from '../db';
import { forbidden } from '../errors';
import { canComment } from '../permissions';
import { loadTask } from './tasks';

export async function addComment(user: SessionUser, code: string, rawInput: unknown) {
  const input = commentSchema.parse(rawInput);
  const task = await loadTask(prisma, user, code);
  // BR-10: المكتملة تقبل التعليق فقط — لذا لا يُفحص القفل هنا
  if (!canComment(user, task)) throw forbidden();
  const a = await prisma.taskActivity.create({
    data: { taskId: task.id, actorId: user.id, type: 'COMMENT', body: input.body },
    include: { actor: { select: { id: true, fullNameAr: true } } },
  });
  return { id: a.id, type: a.type, body: a.body, actor: a.actor, createdAt: a.createdAt.toISOString() };
}
