// NFR-02: تحديد محاولات الدخول — 5 محاولات فاشلة خلال 15 دقيقة
import { prisma } from '../db';

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function isLoginBlocked(email: string, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: { email, succeeded: true, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const failures = await prisma.loginAttempt.count({
    where: { email, succeeded: false, createdAt: { gte: lastSuccess?.createdAt ?? since } },
  });
  return failures >= LOGIN_MAX_FAILURES;
}

export async function recordLoginAttempt(email: string, ip: string | null, succeeded: boolean) {
  await prisma.loginAttempt.create({ data: { email, ip, succeeded } });
}
