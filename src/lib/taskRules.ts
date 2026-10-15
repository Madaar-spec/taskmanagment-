// طبقة قواعد الأعمال — دوال نقية مشتركة بين الخادم (المرجع الملزم) والواجهة (للتجربة فقط).
import { diffDays } from './dates';
import { t } from './i18n';

export const ROLES = ['EMPLOYEE', 'MANAGER', 'VIEWER', 'ADMIN'] as const;
export const STATUSES = ['NEW', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type Role = (typeof ROLES)[number];
export type Status = (typeof STATUSES)[number];
export type PriorityLevel = (typeof PRIORITIES)[number];

/** BR-11 */
export const TASK_CODE_START = 1001;
export const TASK_CODE_PATTERN = /^T-\d{4,}$/;
/** BR-12 */
export const REQUEST_REF_PATTERN = /^REQ-\d{4}-\d{4}$/;
/** BR-17 */
export const LIMITS = {
  titleMin: 5,
  titleMax: 200,
  descriptionMax: 2000,
  subtaskMax: 200,
  commentMin: 1,
  commentMax: 1000,
  subtasksPerTask: 20,
  reasonMin: 10,
  reasonMax: 1000,
} as const;
/** FR-07 */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** FR-22 */
export const PAGE_SIZE = 25;
/** BR-04 — «قريبة الاستحقاق» إذا بقي بين 0 ويومين */
export const DUE_SOON_DAYS = 2;

export const MANAGERS: readonly Role[] = ['MANAGER', 'ADMIN'];

// ───────────────────────── BR-05: مصفوفة الانتقالات ─────────────────────────

export interface TransitionRule {
  from: Status;
  to: Status;
  /** BR-09 */
  requiresReason: boolean;
  /** أدوار محددة لهذا الانتقال (فوق صلاحية تغيير الحالة العامة) */
  roles: readonly Role[] | null;
  activity: 'STATUS_CHANGED' | 'REOPENED';
}

/** خمسة انتقالات فقط مسموحة، وما عداها يُرفض (BR-05) */
export const TRANSITIONS: readonly TransitionRule[] = [
  { from: 'NEW', to: 'IN_PROGRESS', requiresReason: false, roles: null, activity: 'STATUS_CHANGED' },
  { from: 'IN_PROGRESS', to: 'REVIEW', requiresReason: false, roles: null, activity: 'STATUS_CHANGED' },
  // FR-14، BR-09: الإعادة من المراجعة بسبب إلزامي
  { from: 'REVIEW', to: 'IN_PROGRESS', requiresReason: true, roles: null, activity: 'STATUS_CHANGED' },
  // BR-07: الإكمال من المراجعة فقط وباعتماد المدير
  { from: 'REVIEW', to: 'DONE', requiresReason: false, roles: MANAGERS, activity: 'STATUS_CHANGED' },
  // BR-09: إعادة الفتح للمدير ومسؤول النظام فقط وبسبب
  { from: 'DONE', to: 'IN_PROGRESS', requiresReason: true, roles: MANAGERS, activity: 'REOPENED' },
];

export function findTransition(from: Status, to: Status): TransitionRule | undefined {
  return TRANSITIONS.find((r) => r.from === from && r.to === to);
}

export function transitionsFrom(from: Status): TransitionRule[] {
  return TRANSITIONS.filter((r) => r.from === from);
}

export interface RuleViolation {
  /** رمز القاعدة أو FORBIDDEN */
  code: string;
  status: 403 | 422;
  message: string;
  field: string | null;
}

export interface TransitionContext {
  from: Status;
  to: Status;
  role: Role;
  /** هل يملك المستخدم صلاحية تغيير حالة هذه المهمة أصلاً (نطاقه/دوره) */
  canChangeStatus: boolean;
  subtasks: readonly { isDone: boolean }[];
  reason?: string | null;
}

/**
 * التحقق من انتقال الحالة — BR-05، BR-06، BR-07، BR-09.
 * يُرجِع null إن كان الانتقال مسموحاً.
 */
export function checkTransition(ctx: TransitionContext): RuleViolation | null {
  const rule = findTransition(ctx.from, ctx.to);
  if (!rule) {
    return {
      code: 'BR-05',
      status: 422,
      message: t('errors.transitionNotAllowed', { from: t(`status.${ctx.from}`), to: t(`status.${ctx.to}`) }),
      field: 'to',
    };
  }
  if (!ctx.canChangeStatus) {
    return { code: 'FORBIDDEN', status: 403, message: t('errors.FORBIDDEN'), field: null };
  }
  if (rule.roles && !rule.roles.includes(ctx.role)) {
    const code = rule.to === 'DONE' ? 'BR-07' : 'BR-09';
    const message = rule.to === 'DONE' ? t('errors.doneRequiresManager') : t('errors.reopenRequiresManager');
    // AC-07: الطلب المباشر للـ API يُرجِع 403
    return { code, status: 403, message, field: null };
  }
  if (rule.requiresReason && !isValidReason(ctx.reason)) {
    return { code: 'BR-09', status: 422, message: t('errors.reasonRequired'), field: 'reason' };
  }
  if (rule.to === 'REVIEW' && !allSubtasksDone(ctx.subtasks)) {
    return { code: 'BR-06', status: 422, message: t('errors.subtasksIncomplete'), field: null };
  }
  return null;
}

/** BR-09: سبب نصي 10 أحرف على الأقل بعد إزالة المسافات الطرفية */
export function isValidReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length >= LIMITS.reasonMin;
}

/** BR-06 */
export function allSubtasksDone(subtasks: readonly { isDone: boolean }[]): boolean {
  return subtasks.every((s) => s.isDone);
}

export interface AllowedTransition {
  to: Status;
  requiresReason: boolean;
  /** مسموح للمستخدم من حيث الصلاحية (الأزرار غير المسموحة تُعرض معطّلة) */
  allowed: boolean;
  /** سبب المنع إن وُجد (FORBIDDEN، BR-07، BR-09) */
  blockedBy: string | null;
  /** تنبيه مسبق: BR-06 سيمنع الانتقال حالياً */
  warning: string | null;
}

/** allowedTransitions في GET /tasks/:code */
export function allowedTransitions(
  status: Status,
  role: Role,
  canChangeStatus: boolean,
  subtasks: readonly { isDone: boolean }[],
): AllowedTransition[] {
  return transitionsFrom(status).map((rule) => {
    let blockedBy: string | null = null;
    if (!canChangeStatus) blockedBy = 'FORBIDDEN';
    else if (rule.roles && !rule.roles.includes(role)) blockedBy = rule.to === 'DONE' ? 'BR-07' : 'BR-09';
    const warning = rule.to === 'REVIEW' && !allSubtasksDone(subtasks) ? 'BR-06' : null;
    return { to: rule.to, requiresReason: rule.requiresReason, allowed: blockedBy === null, blockedBy, warning };
  });
}

// ───────────────────────── BR-08: نسبة التقدم ─────────────────────────

export function computeProgress(status: Status, subtasks: readonly { isDone: boolean }[]): number {
  if (status === 'DONE') return 100;
  if (subtasks.length === 0) return 0;
  const done = subtasks.filter((s) => s.isDone).length;
  return Math.round((done / subtasks.length) * 100);
}

// ───────────────────────── BR-04: التأخير والاستحقاق ─────────────────────────

/** عدد الأيام المتبقية (سالب = متأخرة) */
export function daysToDue(dueDate: string, today: string): number {
  return diffDays(today, dueDate);
}

export function isOverdue(status: Status, dueDate: string, today: string): boolean {
  return status !== 'DONE' && daysToDue(dueDate, today) < 0;
}

export function isDueSoon(status: Status, dueDate: string, today: string): boolean {
  if (status === 'DONE') return false;
  const d = daysToDue(dueDate, today);
  return d >= 0 && d <= DUE_SOON_DAYS;
}

/** صيغ العدد العربية: يوم واحد، يومين، 3–10 أيام، 11+ يومًا */
export function formatDayCount(n: number): string {
  const abs = Math.abs(n);
  if (abs === 1) return t('due.day1');
  if (abs === 2) return t('due.day2');
  if (abs >= 3 && abs <= 10) return t('due.daysFew', { n: abs });
  return t('due.daysMany', { n: abs });
}

/** النص المساعد: «تستحق اليوم»، «متبقٍ N أيام»، «متأخرة N أيام»، «منجزة» */
export function dueLabel(status: Status, dueDate: string, today: string): string {
  if (status === 'DONE') return t('due.done');
  const d = daysToDue(dueDate, today);
  if (d === 0) return t('due.today');
  if (d > 0) return t('due.remaining', { days: formatDayCount(d) });
  return t('due.overdue', { days: formatDayCount(d) });
}

// ───────────────────────── BR-16: معدل الإنجاز ─────────────────────────

export function completionRate(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

/** BR-03: تاريخ الاستحقاق لا يقل عن اليوم بتوقيت الرياض */
export function isDueDateAllowed(dueDate: string, today: string): boolean {
  return daysToDue(dueDate, today) >= 0;
}

/** BR-10 */
export function isLocked(status: Status): boolean {
  return status === 'DONE';
}

/** الحرف الأول من الاسم (FR-02) */
export function initialOf(name: string): string {
  return name.trim().charAt(0) || '؟';
}
