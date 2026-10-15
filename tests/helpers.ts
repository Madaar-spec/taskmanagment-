import { prisma } from '@/server/db';
import { loadSessionUser, type SessionUser } from '@/server/auth/currentUser';
import { signSession, SESSION_COOKIE } from '@/server/auth/session';
import { seed, USERS } from '../prisma/seedData';

export const TODAY = '2026-10-15';
export type SeedUser = keyof typeof USERS;

export async function resetDb() {
  return seed(prisma);
}

export async function as(key: SeedUser): Promise<SessionUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: USERS[key].email } });
  return (await loadSessionUser(u.id))!;
}

/** طلب HTTP بجلسة المستخدم لاختبار مسارات API مباشرة */
export async function request(
  key: SeedUser | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<Request> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) {
    const u = await prisma.user.findUniqueOrThrow({ where: { email: USERS[key].email } });
    headers.cookie = `${SESSION_COOKIE}=${await signSession(u.id)}`;
  }
  return new Request(`http://localhost:3000/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });

export async function expectAppError(p: Promise<unknown>, status: number, code?: string) {
  try {
    await p;
  } catch (e) {
    const err = e as { status?: number; code?: string; issues?: unknown };
    if (err.issues) {
      // ZodError ← 400/422 عبر fromZod
      const { fromZod } = await import('@/server/errors');
      const app = fromZod(e as never);
      if (app.status !== status || (code && app.code !== code)) {
        throw new Error(`expected ${status}/${code} got ${app.status}/${app.code}`);
      }
      return app;
    }
    if (err.status !== status || (code && err.code !== code)) {
      throw new Error(`expected ${status}/${code ?? ''} got ${err.status}/${err.code}: ${String(e)}`);
    }
    return e;
  }
  throw new Error(`expected error ${status}/${code} but resolved`);
}
