// مخططات Zod المشتركة بين الواجهة والخادم (القسم 7)
import { z } from 'zod';
import { isIsoDate } from './dates';
import { t } from './i18n';
import { LIMITS, PRIORITIES, REQUEST_REF_PATTERN, ROLES, STATUSES } from './taskRules';

const trimmed = () => z.string({ required_error: t('errors.VALIDATION') }).trim();

/** BR-17: العنوان 5–200 بعد إزالة المسافات الطرفية */
export const titleSchema = trimmed()
  .min(1, t('errors.titleRequired'))
  .min(LIMITS.titleMin, t('errors.titleTooShort'))
  .max(LIMITS.titleMax, t('errors.titleTooLong'));

export const descriptionSchema = trimmed().max(LIMITS.descriptionMax, t('errors.descriptionTooLong'));

/** BR-12: اختياري، وإن أُدخل فبالصيغة REQ-YYYY-NNNN */
export const requestRefSchema = trimmed()
  .transform((v) => v.toUpperCase())
  .refine((v) => v === '' || REQUEST_REF_PATTERN.test(v), t('errors.requestRefInvalid'));

/** صيغة التاريخ فقط — قاعدة «لا يقل عن اليوم» (BR-03) تُفحص في الخدمة بتوقيت الرياض */
export const dueDateSchema = z
  .string({ required_error: t('errors.dueRequired') })
  .trim()
  .min(1, t('errors.dueRequired'))
  .refine(isIsoDate, t('errors.dueInvalid'));

export const subtaskTextSchema = trimmed()
  .min(1, t('errors.subtaskRequired'))
  .max(LIMITS.subtaskMax, t('errors.subtaskTooLong'));

export const prioritySchema = z.enum(PRIORITIES);
export const statusSchema = z.enum(STATUSES);
export const roleSchema = z.enum(ROLES, { errorMap: () => ({ message: t('errors.roleRequired') }) });
const uuid = (msg: string) => z.string({ required_error: msg }).uuid(msg);

// ───────── المهام ─────────

export const createTaskSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional().default(''),
  // BR-02: المسؤول الافتراضي هو المنشئ
  assigneeId: uuid(t('errors.assigneeRequired')).optional().nullable(),
  // BR-02: الأولوية الافتراضية MEDIUM
  priority: prioritySchema.optional().default('MEDIUM'),
  dueDate: dueDateSchema,
  requestRef: requestRefSchema.optional().default(''),
  subtasks: z
    .array(subtaskTextSchema)
    .max(LIMITS.subtasksPerTask, t('errors.subtaskLimit'))
    .optional()
    .default([]),
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

/** FR-13 — لا يشمل الحالة؛ updatedAt للتحكم بالتعارض (409) */
export const updateTaskSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    assigneeId: uuid(t('errors.assigneeRequired')).optional(),
    priority: prioritySchema.optional(),
    dueDate: dueDateSchema.optional(),
    requestRef: requestRefSchema.optional(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const transitionSchema = z.object({
  to: statusSchema,
  reason: z.string().trim().max(LIMITS.reasonMax).optional().nullable(),
});

export const addSubtaskSchema = z.object({ text: subtaskTextSchema });
export const updateSubtaskSchema = z
  .object({ isDone: z.boolean().optional(), text: subtaskTextSchema.optional() })
  .refine((v) => v.isDone !== undefined || v.text !== undefined, t('errors.VALIDATION'));

export const commentSchema = z.object({
  body: trimmed()
    .min(LIMITS.commentMin, t('errors.commentRequired'))
    .max(LIMITS.commentMax, t('errors.commentTooLong')),
});

export const VIEWS = ['all', 'mine', 'overdue', 'done'] as const;
export type TaskView = (typeof VIEWS)[number];
export const SORT_KEYS = ['code', 'title', 'assignee', 'priority', 'dueDate', 'progress', 'status'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values)));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || isIsoDate(v), t('errors.dueInvalid'));

export const listQuerySchema = z.object({
  view: z.enum(VIEWS).optional().default('all'),
  status: csvEnum(STATUSES),
  priority: csvEnum(PRIORITIES),
  assigneeId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().uuid().optional()),
  dueFrom: optionalDate,
  dueTo: optionalDate,
  q: z
    .string()
    .optional()
    .transform((v) => v?.trim().slice(0, 100) || undefined),
  sort: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(
      z
        .string()
        .regex(new RegExp(`^-?(${SORT_KEYS.join('|')})$`))
        .optional(),
    ),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(25),
});
export type ListQuery = z.output<typeof listQuerySchema>;

// ───────── الدخول ─────────

export const loginSchema = z.object({
  email: z
    .string({ required_error: t('errors.emailRequired') })
    .trim()
    .toLowerCase()
    .min(1, t('errors.emailRequired'))
    .email(t('errors.emailInvalid')),
  password: z.string({ required_error: t('errors.passwordRequired') }).min(1, t('errors.passwordRequired')),
});

// ───────── الإدارة (FR-31، FR-32) ─────────

const fullName = trimmed().min(1, t('errors.fullNameRequired')).max(150, t('errors.fullNameTooLong'));
const email = z
  .string({ required_error: t('errors.emailRequired') })
  .trim()
  .toLowerCase()
  .min(1, t('errors.emailRequired'))
  .max(200)
  .email(t('errors.emailInvalid'));
const password = z.string().min(8, t('errors.passwordTooShort')).max(200);

export const adminCreateUserSchema = z.object({
  fullNameAr: fullName,
  email,
  password,
  role: roleSchema,
  departmentId: uuid(t('errors.departmentRequired')),
});

export const adminUpdateUserSchema = z
  .object({
    fullNameAr: fullName.optional(),
    email: email.optional(),
    password: z
      .union([password, z.literal('')])
      .optional()
      .transform((v) => (v ? v : undefined)),
    role: roleSchema.optional(),
    departmentId: uuid(t('errors.departmentRequired')).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const deptName = trimmed().min(1, t('errors.departmentNameRequired')).max(150, t('errors.departmentNameTooLong'));

export const adminDepartmentSchema = z.object({
  nameAr: deptName,
  managerId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});
export const adminUpdateDepartmentSchema = adminDepartmentSchema.partial();

/** حقول ترتبط بقاعدة أعمال (لإرجاع 422 برمز القاعدة بدلاً من 400) */
export const FIELD_RULES: Record<string, string> = {
  title: 'BR-17',
  description: 'BR-17',
  subtasks: 'BR-17',
  text: 'BR-17',
  body: 'BR-17',
  requestRef: 'BR-12',
  reason: 'BR-09',
};

/** تحويل أخطاء Zod إلى خريطة حقل ← رسالة (FR-30) */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
