// خدمة المهام — كل قواعد الأعمال تُفرض هنا (القسم 4)، وكل استعلام يمر عبر scopeTasks (BR-01).
import { Prisma, type Task } from '@prisma/client';
import { addDays, dateOnly, toDbDate } from '@/lib/dates';
import { t } from '@/lib/i18n';
import type { ListQuery, SortKey } from '@/lib/schemas';
import { createTaskSchema, listQuerySchema, transitionSchema, updateTaskSchema } from '@/lib/schemas';
import {
  allowedTransitions,
  checkTransition,
  completionRate,
  computeProgress,
  daysToDue,
  findTransition,
  isDueDateAllowed,
  isDueSoon,
  isLocked,
  isOverdue,
  type Status,
} from '@/lib/taskRules';
import type { SessionUser } from '../auth/currentUser';
import { prisma, type Tx } from '../db';
import { conflict, forbidden, fromViolation, notFound, ruleError } from '../errors';
import {
  assertCanAssign,
  canChangeStatus,
  canComment,
  canCreateTask,
  canDeleteTask,
  canEditTask,
  scopeTasks,
} from '../permissions';
import { notify } from './notifications';

// ───────────────────────── أنواع الاستجابة ─────────────────────────

export interface TaskListItem {
  id: string;
  code: string;
  title: string;
  status: Status;
  priority: Task['priority'];
  dueDate: string;
  requestRef: string | null;
  assignee: { id: string; fullNameAr: string };
  department: { id: string; nameAr: string };
  progress: number;
  isOverdue: boolean;
  isDueSoon: boolean;
  daysToDue: number;
  subtaskCount: number;
  subtaskDone: number;
  updatedAt: string;
}

const listInclude = {
  assignee: { select: { id: true, fullNameAr: true } },
  department: { select: { id: true, nameAr: true } },
  subtasks: { select: { isDone: true } },
} satisfies Prisma.TaskInclude;

type ListRow = Prisma.TaskGetPayload<{ include: typeof listInclude }>;

function toListItem(row: ListRow, today: string): TaskListItem {
  const due = dateOnly(row.dueDate);
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: due,
    requestRef: row.requestRef,
    assignee: row.assignee,
    department: row.department,
    // BR-08، BR-04: تُحسب لحظة الاستعلام ولا تُخزَّن
    progress: computeProgress(row.status, row.subtasks),
    isOverdue: isOverdue(row.status, due, today),
    isDueSoon: isDueSoon(row.status, due, today),
    daysToDue: daysToDue(due, today),
    subtaskCount: row.subtasks.length,
    subtaskDone: row.subtasks.filter((s) => s.isDone).length,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ───────────────────────── بناء شروط التصفية ─────────────────────────

const notDone: Prisma.TaskWhereInput = { status: { not: 'DONE' } };

export function overdueWhere(today: string): Prisma.TaskWhereInput {
  return { ...notDone, dueDate: { lt: toDbDate(today) } };
}

export function dueSoonWhere(today: string): Prisma.TaskWhereInput {
  return { ...notDone, dueDate: { gte: toDbDate(today), lte: toDbDate(addDays(today, 2)) } };
}

function viewWhere(user: SessionUser, view: ListQuery['view'], today: string): Prisma.TaskWhereInput {
  switch (view) {
    case 'mine':
      return { assigneeId: user.id };
    case 'overdue':
      return overdueWhere(today);
    case 'done':
      return { status: 'DONE' };
    default:
      return {};
  }
}

/** FR-18: بحث في رقم المهمة والعنوان واسم المسؤول ورقم الطلب واسم الإدارة */
function searchWhere(q: string | undefined): Prisma.TaskWhereInput {
  if (!q) return {};
  const contains = { contains: q, mode: 'insensitive' as const };
  return {
    OR: [
      { code: contains },
      { title: contains },
      { requestRef: contains },
      { assignee: { fullNameAr: contains } },
      { department: { nameAr: contains } },
    ],
  };
}

export function buildWhere(
  user: SessionUser,
  query: ListQuery,
  today: string,
  opts: { status?: boolean; view?: boolean } = {},
): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [scopeTasks(user)];
  if (opts.view !== false) and.push(viewWhere(user, query.view, today));
  if (opts.status !== false && query.status.length) and.push({ status: { in: query.status } });
  if (query.priority.length) and.push({ priority: { in: query.priority } });
  if (query.assigneeId) and.push({ assigneeId: query.assigneeId });
  if (query.dueFrom) and.push({ dueDate: { gte: toDbDate(query.dueFrom) } });
  if (query.dueTo) and.push({ dueDate: { lte: toDbDate(query.dueTo) } });
  if (query.q) and.push(searchWhere(query.q));
  return { AND: and };
}

/** FR-21: الافتراضي — المتأخرة أولاً ثم الأقرب استحقاقاً (والمكتملة آخراً) */
const DEFAULT_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  // غير المكتملة completed_at فيها فارغ فتأتي أولاً؛ وأقدم استحقاق بينها هو المتأخر
  { completedAt: { sort: 'desc', nulls: 'first' } },
  { dueDate: 'asc' },
  { createdAt: 'desc' },
];

function orderFor(sort: string | undefined): Prisma.TaskOrderByWithRelationInput[] {
  if (!sort) return DEFAULT_ORDER;
  const dir: Prisma.SortOrder = sort.startsWith('-') ? 'desc' : 'asc';
  const key = sort.replace(/^-/, '') as SortKey;
  const tie: Prisma.TaskOrderByWithRelationInput = { createdAt: 'desc' };
  switch (key) {
    case 'code':
      // الرقم تسلسلي، فترتيب الإنشاء يطابق ترتيب الرقم (BR-11)
      return [{ createdAt: dir }];
    case 'title':
      return [{ title: dir }, tie];
    case 'assignee':
      return [{ assignee: { fullNameAr: dir } }, tie];
    case 'priority':
      return [{ priority: dir }, tie];
    case 'dueDate':
      return [{ dueDate: dir }, tie];
    case 'status':
      return [{ status: dir }, tie];
    default:
      return DEFAULT_ORDER;
  }
}

// ───────────────────────── GET /tasks ─────────────────────────

export async function listTasks(user: SessionUser, rawQuery: unknown, today: string) {
  const query = listQuerySchema.parse(rawQuery);
  const where = buildWhere(user, query, today);
  const skip = (query.page - 1) * query.pageSize;

  const sortKey = query.sort?.replace(/^-/, '');
  if (sortKey === 'progress') {
    // التقدم محسوب (BR-08) فيُرتَّب في الذاكرة على المعرّفات فقط
    const all = await prisma.task.findMany({
      where,
      select: { id: true, status: true, dueDate: true, subtasks: { select: { isDone: true } } },
    });
    const dir = query.sort?.startsWith('-') ? -1 : 1;
    all.sort(
      (a, b) =>
        dir * (computeProgress(a.status, a.subtasks) - computeProgress(b.status, b.subtasks)) ||
        a.dueDate.getTime() - b.dueDate.getTime(),
    );
    const ids = all.slice(skip, skip + query.pageSize).map((r) => r.id);
    const rows = await prisma.task.findMany({ where: { id: { in: ids } }, include: listInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      items: ids.map((id) => toListItem(byId.get(id)!, today)),
      total: all.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: listInclude,
      orderBy: orderFor(query.sort),
      skip,
      take: query.pageSize,
    }),
    prisma.task.count({ where }),
  ]);
  return { items: rows.map((r) => toListItem(r, today)), total, page: query.page, pageSize: query.pageSize };
}

// ───────────────────────── GET /tasks/stats ─────────────────────────

export async function getStats(user: SessionUser, rawQuery: unknown, today: string) {
  const query = listQuerySchema.parse(rawQuery);
  const scope = scopeTasks(user);
  // المؤشرات وشرائح الحالة: نفس عوامل التصفية عدا الحالة نفسها
  const filtered = buildWhere(user, query, today, { status: false });

  const [byStatus, overdue, dueSoon, sAll, sMine, sOverdue, sDone] = await prisma.$transaction([
    prisma.task.groupBy({ by: ['status'], where: filtered, orderBy: { status: 'asc' }, _count: { _all: true } }),
    prisma.task.count({ where: { AND: [filtered, overdueWhere(today)] } }),
    prisma.task.count({ where: { AND: [filtered, dueSoonWhere(today)] } }),
    // عدّادات القائمة الجانبية (FR-20) — ضمن النطاق فقط (BR-01، FR-26)
    prisma.task.count({ where: scope }),
    prisma.task.count({ where: { AND: [scope, { assigneeId: user.id }] } }),
    prisma.task.count({ where: { AND: [scope, overdueWhere(today)] } }),
    prisma.task.count({ where: { AND: [scope, { status: 'DONE' }] } }),
  ]);

  const counts: Record<Status, number> = { NEW: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 };
  for (const row of byStatus) {
    const c = row._count;
    counts[row.status] = typeof c === 'object' && c ? (c._all ?? 0) : 0;
  }
  const total = counts.NEW + counts.IN_PROGRESS + counts.REVIEW + counts.DONE;

  return {
    // FR-25
    kpi: {
      total,
      new: counts.NEW,
      active: counts.IN_PROGRESS + counts.REVIEW,
      review: counts.REVIEW,
      overdue,
      dueSoon,
      done: counts.DONE,
      // BR-16
      completionRate: completionRate(counts.DONE, total),
    },
    byStatus: counts,
    sidebar: {
      all: sAll,
      mine: sMine,
      overdue: sOverdue,
      done: sDone,
      completionRate: completionRate(sDone, sAll),
    },
    // FR-27: جرس التنبيهات بعدد المهام المتأخرة
    bell: sOverdue,
  };
}

// ───────────────────────── GET /tasks/:code ─────────────────────────

/** تحميل مهمة ضمن النطاق أو 404 (BR-01) */
export async function loadTask(db: Tx, user: SessionUser, code: string) {
  const task = await db.task.findFirst({ where: { AND: [scopeTasks(user), { code: code.toUpperCase() }] } });
  if (!task) throw notFound();
  return task;
}

const detailInclude = {
  assignee: { select: { id: true, fullNameAr: true } },
  createdBy: { select: { id: true, fullNameAr: true } },
  completedBy: { select: { id: true, fullNameAr: true } },
  department: { select: { id: true, nameAr: true } },
  subtasks: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  activities: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { actor: { select: { id: true, fullNameAr: true } } },
  },
  attachments: {
    orderBy: { createdAt: 'asc' },
    include: { uploadedBy: { select: { id: true, fullNameAr: true } } },
  },
} satisfies Prisma.TaskInclude;

export async function getTask(user: SessionUser, code: string, today: string) {
  const base = await loadTask(prisma, user, code);
  const task = await prisma.task.findUniqueOrThrow({ where: { id: base.id }, include: detailInclude });
  const due = dateOnly(task.dueDate);
  const editable = canEditTask(user, task) && !isLocked(task.status);
  return {
    id: task.id,
    code: task.code,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: due,
    requestRef: task.requestRef,
    assignee: task.assignee,
    createdBy: task.createdBy,
    completedBy: task.completedBy,
    completedAt: task.completedAt?.toISOString() ?? null,
    department: task.department,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    progress: computeProgress(task.status, task.subtasks),
    isOverdue: isOverdue(task.status, due, today),
    isDueSoon: isDueSoon(task.status, due, today),
    daysToDue: daysToDue(due, today),
    subtasks: task.subtasks.map((s) => ({ id: s.id, text: s.text, isDone: s.isDone, sortOrder: s.sortOrder })),
    // FR-12: خط زمني واحد مرتّب تصاعدياً
    activities: task.activities.map((a) => ({
      id: a.id,
      type: a.type,
      actor: a.actor,
      body: a.body,
      oldValue: a.oldValue,
      newValue: a.newValue,
      createdAt: a.createdAt.toISOString(),
    })),
    attachments: task.attachments.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      uploadedBy: f.uploadedBy,
      createdAt: f.createdAt.toISOString(),
    })),
    // BR-05
    allowedTransitions: allowedTransitions(task.status, user.role, canChangeStatus(user, task), task.subtasks),
    permissions: {
      edit: editable,
      delete: canDeleteTask(user, task) && !isLocked(task.status),
      comment: canComment(user, task),
      subtasks: editable,
      attach: editable,
    },
  };
}
export type TaskDetail = Awaited<ReturnType<typeof getTask>>;

// ───────────────────────── POST /tasks ─────────────────────────

async function resolveAssignee(db: Tx, user: SessionUser, assigneeId: string) {
  const assignee = await db.user.findUnique({
    where: { id: assigneeId },
    select: { id: true, fullNameAr: true, departmentId: true, isActive: true },
  });
  assertCanAssign(user, assignee); // BR-13
  return assignee as NonNullable<typeof assignee>;
}

function assertDueDate(dueDate: string, today: string) {
  // BR-03
  if (!isDueDateAllowed(dueDate, today)) throw ruleError('BR-03', t('errors.duePast'), 'dueDate');
}

export async function createTask(user: SessionUser, rawInput: unknown, today: string) {
  if (!canCreateTask(user)) throw forbidden();
  const input = createTaskSchema.parse(rawInput);
  assertDueDate(input.dueDate, today);

  return prisma.$transaction(async (tx) => {
    // BR-02: المسؤول الافتراضي هو المنشئ
    const assignee = await resolveAssignee(tx, user, input.assigneeId ?? user.id);
    const task = await tx.task.create({
      data: {
        title: input.title,
        description: input.description || null,
        priority: input.priority,
        status: 'NEW', // BR-02
        dueDate: toDbDate(input.dueDate),
        requestRef: input.requestRef || null,
        assigneeId: assignee.id,
        // إدارة المسؤول لحظة الإسناد (BR-01)
        departmentId: assignee.departmentId,
        createdById: user.id,
        subtasks: { create: input.subtasks.map((text, i) => ({ text, sortOrder: i + 1 })) },
      },
    });
    // FR-11
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: user.id,
        type: 'CREATED',
        newValue: {
          code: task.code,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: input.dueDate,
          assignee: { id: assignee.id, name: assignee.fullNameAr },
        },
      },
    });
    // FR-28
    if (assignee.id !== user.id) {
      await notify(tx, assignee.id, task.id, t('notifications.assigned', { code: task.code, title: task.title }));
    }
    return { id: task.id, code: task.code };
  });
}

// ───────────────────────── PATCH /tasks/:code ─────────────────────────

export async function updateTask(user: SessionUser, code: string, rawInput: unknown, today: string) {
  const input = updateTaskSchema.parse(rawInput);
  return prisma.$transaction(async (tx) => {
    const task = await loadTask(tx, user, code);
    if (!canEditTask(user, task)) throw forbidden();
    if (isLocked(task.status)) throw ruleError('BR-10', t('errors.taskLocked')); // BR-10
    // 409: تعارض تحديث
    if (task.updatedAt.toISOString() !== new Date(input.updatedAt).toISOString()) throw conflict();

    const data: Prisma.TaskUncheckedUpdateInput = {};
    const activities: Prisma.TaskActivityCreateManyInput[] = [];
    const log = (type: Prisma.TaskActivityCreateManyInput['type'], oldValue: object, newValue: object) =>
      activities.push({ taskId: task.id, actorId: user.id, type, oldValue, newValue });

    if (input.title !== undefined && input.title !== task.title) data.title = input.title;
    if (input.description !== undefined && (input.description || null) !== task.description) {
      data.description = input.description || null;
    }
    if (input.requestRef !== undefined && (input.requestRef || null) !== task.requestRef) {
      data.requestRef = input.requestRef || null;
    }
    if (input.priority !== undefined && input.priority !== task.priority) {
      data.priority = input.priority;
      log('PRIORITY_CHANGED', { priority: task.priority }, { priority: input.priority });
    }
    const oldDue = dateOnly(task.dueDate);
    if (input.dueDate !== undefined && input.dueDate !== oldDue) {
      assertDueDate(input.dueDate, today);
      data.dueDate = toDbDate(input.dueDate);
      log('DUE_CHANGED', { dueDate: oldDue }, { dueDate: input.dueDate });
    }
    let newAssignee: { id: string; fullNameAr: string } | null = null;
    if (input.assigneeId !== undefined && input.assigneeId !== task.assigneeId) {
      const assignee = await resolveAssignee(tx, user, input.assigneeId);
      const previous = await tx.user.findUniqueOrThrow({
        where: { id: task.assigneeId },
        select: { id: true, fullNameAr: true },
      });
      data.assigneeId = assignee.id;
      data.departmentId = assignee.departmentId;
      newAssignee = assignee;
      log(
        'ASSIGNEE_CHANGED',
        { id: previous.id, name: previous.fullNameAr },
        { id: assignee.id, name: assignee.fullNameAr },
      );
    }

    if (Object.keys(data).length === 0) return { code: task.code, updatedAt: task.updatedAt.toISOString() };

    const res = await tx.task.updateMany({ where: { id: task.id, updatedAt: task.updatedAt }, data });
    if (res.count !== 1) throw conflict();
    if (activities.length) await tx.taskActivity.createMany({ data: activities });
    // BR-13: تغيير المسؤول يُشعر المسؤول الجديد
    if (newAssignee && newAssignee.id !== user.id) {
      await notify(
        tx,
        newAssignee.id,
        task.id,
        t('notifications.assigned', { code: task.code, title: (data.title as string) ?? task.title }),
      );
    }
    const updated = await tx.task.findUniqueOrThrow({ where: { id: task.id }, select: { updatedAt: true } });
    return { code: task.code, updatedAt: updated.updatedAt.toISOString() };
  });
}

// ───────────────────────── POST /tasks/:code/transition ─────────────────────────

/** تغيير الحالة في معاملة واحدة مع سجل النشاط والتنبيه (BR-05 إلى BR-09) */
export async function transitionTask(user: SessionUser, code: string, rawInput: unknown) {
  const input = transitionSchema.parse(rawInput);
  return prisma.$transaction(async (tx) => {
    const task = await loadTask(tx, user, code);
    const subtasks = await tx.subtask.findMany({ where: { taskId: task.id }, select: { isDone: true } });
    const violation = checkTransition({
      from: task.status,
      to: input.to,
      role: user.role,
      canChangeStatus: canChangeStatus(user, task),
      subtasks,
      reason: input.reason,
    });
    if (violation) throw fromViolation(violation);
    const rule = findTransition(task.status, input.to)!;
    const reason = rule.requiresReason ? input.reason!.trim() : null;

    const data: Prisma.TaskUncheckedUpdateManyInput = { status: input.to };
    if (input.to === 'DONE') {
      // BR-07
      data.completedAt = new Date();
      data.completedById = user.id;
    } else if (task.status === 'DONE') {
      data.completedAt = null;
      data.completedById = null;
    }
    // الحالة السابقة شرط في التحديث لمنع الانتقالات المتزامنة
    const res = await tx.task.updateMany({ where: { id: task.id, status: task.status }, data });
    if (res.count !== 1) throw conflict();

    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: user.id,
        type: rule.activity,
        body: reason,
        oldValue: { status: task.status },
        newValue: { status: input.to },
      },
    });

    // FR-28
    if (task.status === 'REVIEW' && input.to === 'IN_PROGRESS' && task.assigneeId !== user.id) {
      await notify(tx, task.assigneeId, task.id, t('notifications.returned', { code: task.code, reason: reason! }));
    }
    if (task.status === 'DONE' && task.assigneeId !== user.id) {
      await notify(tx, task.assigneeId, task.id, t('notifications.reopened', { code: task.code, reason: reason! }));
    }
    if (input.to === 'DONE' && task.createdById !== user.id) {
      await notify(tx, task.createdById, task.id, t('notifications.completed', { code: task.code, title: task.title }));
    }
    return { code: task.code, status: input.to };
  });
}

// ───────────────────────── DELETE /tasks/:code ─────────────────────────

export async function deleteTask(user: SessionUser, code: string) {
  return prisma.$transaction(async (tx) => {
    const task = await loadTask(tx, user, code);
    if (!canDeleteTask(user, task)) throw forbidden();
    // BR-14: للمهام غير المكتملة فقط
    if (task.status === 'DONE') throw ruleError('BR-14', t('errors.deleteDoneNotAllowed'));
    await tx.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
    return { code: task.code };
  });
}
