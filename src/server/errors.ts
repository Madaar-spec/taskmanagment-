import { ZodError } from 'zod';
import { FIELD_RULES } from '@/lib/schemas';
import { t } from '@/lib/i18n';
import type { RuleViolation } from '@/lib/taskRules';

/** الخطأ بالشكل { error: { code, message, field } } — القسم 7 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field: string | null = null,
  ) {
    super(message);
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, field: this.field } };
  }
}

export const badRequest = (message = t('errors.VALIDATION'), field: string | null = null) =>
  new AppError(400, 'VALIDATION', message, field);
export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', t('errors.UNAUTHENTICATED'));
export const forbidden = (message = t('errors.FORBIDDEN')) => new AppError(403, 'FORBIDDEN', message);
/** BR-01: المهمة خارج النطاق تُرجِع 404 */
export const notFound = () => new AppError(404, 'NOT_FOUND', t('errors.NOT_FOUND'));
export const conflict = () => new AppError(409, 'CONFLICT', t('errors.CONFLICT'));
/** مخالفة قاعدة أعمال → 422 برمز القاعدة */
export const ruleError = (code: string, message: string, field: string | null = null) =>
  new AppError(422, code, message, field);

export function fromViolation(v: RuleViolation): AppError {
  return new AppError(v.status, v.code, v.message, v.field);
}

export function fromZod(error: ZodError): AppError {
  const issue = error.issues[0];
  const field = issue ? String(issue.path[0] ?? '') || null : null;
  const message = issue?.message ?? t('errors.VALIDATION');
  const rule = field ? FIELD_RULES[field] : undefined;
  return rule ? ruleError(rule, message, field) : badRequest(message, field);
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return fromZod(err);
  console.error(err);
  return new AppError(500, 'INTERNAL', t('errors.INTERNAL'));
}
