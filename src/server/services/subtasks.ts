// FR-06، FR-09: المهام الفرعية — BR-08، BR-10، BR-17
import { t } from '@/lib/i18n';
import { addSubtaskSchema, updateSubtaskSchema } from '@/lib/schemas';
import { isLocked, LIMITS } from '@/lib/taskRules';
import type { SessionUser } from '../auth/currentUser';
import { prisma, type Tx } from '../db';
import { forbidden, notFound, ruleError } from '../errors';
import { canEditTask, scopeTasks } from '../permissions';
import { loadTask } from './tasks';

function assertEditable(user: SessionUser, task: Parameters<typeof canEditTask>[1] & { status: string }) {
  if (!canEditTask(user, task)) throw forbidden();
  if (isLocked(task.status as 'DONE')) throw ruleError('BR-10', t('errors.taskLocked'));
}

export async function addSubtask(user: SessionUser, code: string, rawInput: unknown) {
  const input = addSubtaskSchema.parse(rawInput);
  return prisma.$transaction(async (tx) => {
    const task = await loadTask(tx, user, code);
    assertEditable(user, task);
    const agg = await tx.subtask.aggregate({ where: { taskId: task.id }, _count: true, _max: { sortOrder: true } });
    if (agg._count >= LIMITS.subtasksPerTask) throw ruleError('BR-17', t('errors.subtaskLimit'), 'text');
    const s = await tx.subtask.create({
      data: { taskId: task.id, text: input.text, sortOrder: (agg._max.sortOrder ?? 0) + 1 },
    });
    return { id: s.id, text: s.text, isDone: s.isDone, sortOrder: s.sortOrder };
  });
}

async function loadSubtask(tx: Tx, user: SessionUser, id: string) {
  const sub = await tx.subtask.findFirst({ where: { id, task: scopeTasks(user) }, include: { task: true } });
  if (!sub) throw notFound();
  return sub;
}

export async function updateSubtask(user: SessionUser, id: string, rawInput: unknown) {
  const input = updateSubtaskSchema.parse(rawInput);
  return prisma.$transaction(async (tx) => {
    const sub = await loadSubtask(tx, user, id);
    assertEditable(user, sub.task);
    const updated = await tx.subtask.update({
      where: { id },
      data: { ...(input.isDone !== undefined && { isDone: input.isDone }), ...(input.text && { text: input.text }) },
    });
    if (input.isDone !== undefined && input.isDone !== sub.isDone) {
      // FR-11
      await tx.taskActivity.create({
        data: {
          taskId: sub.taskId,
          actorId: user.id,
          type: 'SUBTASK_TOGGLED',
          oldValue: { subtaskId: id, text: sub.text, isDone: sub.isDone },
          newValue: { subtaskId: id, text: updated.text, isDone: updated.isDone },
        },
      });
    }
    return { id: updated.id, text: updated.text, isDone: updated.isDone, sortOrder: updated.sortOrder };
  });
}

export async function deleteSubtask(user: SessionUser, id: string) {
  return prisma.$transaction(async (tx) => {
    const sub = await loadSubtask(tx, user, id);
    assertEditable(user, sub.task);
    await tx.subtask.delete({ where: { id } });
    return { id };
  });
}
