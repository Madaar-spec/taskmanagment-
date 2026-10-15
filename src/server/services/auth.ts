// FR-01، FR-03، NFR-02
import { t } from '@/lib/i18n';
import { loginSchema } from '@/lib/schemas';
import { authProvider } from '../auth/provider';
import { isLoginBlocked, recordLoginAttempt } from '../auth/rateLimit';
import { signSession } from '../auth/session';
import { AppError } from '../errors';

export async function login(raw: unknown, ip: string | null) {
  const { email, password } = loginSchema.parse(raw);
  if (await isLoginBlocked(email)) throw new AppError(429, 'RATE_LIMITED', t('auth.tooManyAttempts'));
  const identity = await authProvider.authenticate({ email, password });
  await recordLoginAttempt(email, ip, identity !== null);
  if (!identity) throw new AppError(401, 'INVALID_CREDENTIALS', t('auth.invalidCredentials'));
  return { token: await signSession(identity.userId), userId: identity.userId };
}
