// POST /api/v1/auth/login — FR-01
import { loadSessionUser } from '@/server/auth/currentUser';
import { serializeCookie, SESSION_COOKIE, SESSION_IDLE_SECONDS } from '@/server/auth/session';
import { json, publicRoute, readJson } from '@/server/http';
import { login } from '@/server/services/auth';

export const POST = publicRoute(async (req) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const { token, userId } = await login(await readJson(req), ip);
  const user = await loadSessionUser(userId);
  return json({ user }, 200, { 'set-cookie': serializeCookie(SESSION_COOKIE, token, SESSION_IDLE_SECONDS) });
});
