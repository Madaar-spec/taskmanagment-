// POST /api/v1/auth/logout — FR-03
import { serializeCookie, SESSION_COOKIE } from '@/server/auth/session';
import { json, publicRoute } from '@/server/http';

export const POST = publicRoute(async () =>
  json({ ok: true }, 200, { 'set-cookie': serializeCookie(SESSION_COOKIE, '', 0) }),
);
