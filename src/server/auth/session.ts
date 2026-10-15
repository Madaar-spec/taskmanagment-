// FR-03، NFR-02: جلسة موقّعة في ملف تعريف HttpOnly/Secure/SameSite=Lax
// تنتهي بعد 30 دقيقة من عدم النشاط (تجديد منزلق في middleware مع كل طلب من المستخدم).
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'madaar_session';
export const SESSION_IDLE_SECONDS = 30 * 60;
/** طلبات الخلفية (الاستطلاع الدوري) لا تُعدّ نشاطاً ولا تجدّد الجلسة */
export const BACKGROUND_HEADER = 'x-madaar-background';

export interface SessionPayload {
  sub: string;
  /** إصدار الجلسة لإبطالها عند تعطيل المستخدم (يُتحقق من is_active في كل طلب أيضاً) */
  iat?: number;
  exp?: number;
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (≥ 32 chars)');
  return new TextEncoder().encode(s);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_IDLE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    return { sub: payload.sub, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_IDLE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, maxAge: number): string {
  const o = sessionCookieOptions(maxAge);
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${o.path}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    o.secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}
