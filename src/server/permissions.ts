// القسم 2: الأدوار والصلاحيات — تُفرض هنا في الخادم وليس في الواجهة فقط.
import type { Prisma } from '@prisma/client';
import type { SessionUser } from './auth/currentUser';
import { t } from '@/lib/i18n';
import { ruleError } from './errors';

interface TaskRef {
  assigneeId: string;
  createdById: string;
  departmentId: string;
}

/**
 * BR-01: دالة النطاق المركزية — تُستخدم في كل استعلام على المهام (القوائم والمؤشرات والبحث والتفاصيل).
 * المحذوفة منطقياً لا تظهر في أي قائمة أو مؤشر (BR-14).
 */
export function scopeTasks(user: SessionUser): Prisma.TaskWhereInput {
  const base: Prisma.TaskWhereInput = { deletedAt: null };
  switch (user.role) {
    case 'ADMIN':
      return base;
    case 'MANAGER':
    case 'VIEWER':
      // مهام إدارتهم (إدارة المسؤول لحظة الإسناد)
      return { ...base, departmentId: user.departmentId };
    case 'EMPLOYEE':
    default:
      return { ...base, OR: [{ assigneeId: user.id }, { createdById: user.id }] };
  }
}

/** هل المهمة ضمن نطاق رؤية المستخدم (BR-01) */
export function inScope(user: SessionUser, task: TaskRef): boolean {
  switch (user.role) {
    case 'ADMIN':
      return true;
    case 'MANAGER':
    case 'VIEWER':
      return task.departmentId === user.departmentId;
    case 'EMPLOYEE':
      return task.assigneeId === user.id || task.createdById === user.id;
    default:
      return false;
  }
}

/** تعديل البيانات والمهام الفرعية وتغيير الحالة (حسب القسم 2). VIEWER قراءة فقط. */
export function canEditTask(user: SessionUser, task: TaskRef): boolean {
  if (user.role === 'VIEWER') return false;
  return inScope(user, task);
}

export const canChangeStatus = canEditTask;

/** التعليق: كل من يرى المهمة عدا المستعرض (قراءة فقط) */
export function canComment(user: SessionUser, task: TaskRef): boolean {
  return user.role !== 'VIEWER' && inScope(user, task);
}

/** الحذف: MANAGER لمهام إدارته، وADMIN لكل المهام (وغير المكتملة فقط — BR-14 في الخدمة) */
export function canDeleteTask(user: SessionUser, task: TaskRef): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'MANAGER') return task.departmentId === user.departmentId;
  return false;
}

export function canCreateTask(user: SessionUser): boolean {
  return user.role !== 'VIEWER';
}

interface AssigneeRef {
  id: string;
  departmentId: string;
  isActive: boolean;
}

/**
 * BR-13: المسؤول مستخدم نشط. MANAGER يُسند داخل إدارته فقط، وEMPLOYEE لنفسه فقط.
 * يُرمى خطأ 422 برمز BR-13 عند المخالفة.
 */
export function assertCanAssign(user: SessionUser, assignee: AssigneeRef | null): asserts assignee is AssigneeRef {
  if (!assignee || !assignee.isActive) {
    throw ruleError('BR-13', t('errors.assigneeInactive'), 'assigneeId');
  }
  if (user.role === 'EMPLOYEE' && assignee.id !== user.id) {
    throw ruleError('BR-13', t('errors.assigneeSelfOnly'), 'assigneeId');
  }
  if (user.role === 'MANAGER' && assignee.departmentId !== user.departmentId) {
    throw ruleError('BR-13', t('errors.assigneeOutOfDepartment'), 'assigneeId');
  }
}

/** المستخدمون المسموح بالإسناد إليهم (GET /users) */
export function assignableUsersWhere(user: SessionUser): Prisma.UserWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return { isActive: true };
    case 'MANAGER':
      return { isActive: true, departmentId: user.departmentId };
    case 'EMPLOYEE':
      return { id: user.id, isActive: true };
    case 'VIEWER':
    default:
      return { id: '00000000-0000-0000-0000-000000000000' };
  }
}

/** المستخدمون الظاهرون في مرشّح «المسؤول» ضمن نطاق الرؤية */
export function visibleUsersWhere(user: SessionUser): Prisma.UserWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'MANAGER':
    case 'VIEWER':
      return { departmentId: user.departmentId };
    case 'EMPLOYEE':
    default:
      return { id: user.id };
  }
}
