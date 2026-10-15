import { getToday } from '@/lib/clock';
import { requireUser, type SessionUser } from './auth/currentUser';
import { badRequest, toAppError } from './errors';

type Ctx = { params: Promise<Record<string, string>> };

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

/** غلاف موحّد لمسارات API: الجلسة (401)، BR-01 عبر الخدمات، وتحويل الأخطاء للشكل الموحّد */
export function route<P extends Record<string, string> = Record<string, string>>(
  fn: (args: { req: Request; user: SessionUser; params: P; today: string }) => Promise<Response | unknown>,
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const user = await requireUser(req);
      const params = ((await ctx?.params) ?? {}) as P;
      const out = await fn({ req, user, params, today: getToday() });
      return out instanceof Response ? out : json(out);
    } catch (err) {
      const e = toAppError(err);
      return json(e.toJSON(), e.status);
    }
  };
}

export function publicRoute(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (err) {
      const e = toAppError(err);
      return json(e.toJSON(), e.status);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest();
  }
}

export function queryObject(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}
