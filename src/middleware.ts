// FR-03: انتهاء الجلسة بعد 30 دقيقة من عدم النشاط (تجديد منزلق)
// NFR-02: حماية CSRF بالتحقق من مصدر الطلب للطرق المغيّرة، مع SameSite=Lax
import { NextResponse, type NextRequest } from 'next/server';
import { BACKGROUND_HEADER, SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from './server/auth/session';

const PUBLIC_API = ['/api/v1/auth/login', '/api/v1/auth/logout'];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message, field: null } }, { status });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (origin) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  // بلا ترويسة Origin: نقبل فقط إن صرّح المتصفح بأن الطلب من الموقع نفسه
  const site = req.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin' || site === 'none';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (isApi && !SAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return errorJson(403, 'CSRF', 'تعذّر التحقق من مصدر الطلب');
  }
  if (PUBLIC_API.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (pathname === '/login') {
    if (session) return NextResponse.redirect(new URL('/tasks', req.url));
    return NextResponse.next();
  }

  if (!session) {
    if (isApi) return errorJson(401, 'UNAUTHENTICATED', 'يجب تسجيل الدخول أولاً');
    const url = new URL('/login', req.url);
    if (token) url.searchParams.set('expired', '1');
    const res = NextResponse.redirect(url);
    if (token) res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
    return res;
  }

  const res = NextResponse.next();
  // طلبات الاستطلاع في الخلفية لا تُعدّ نشاطاً للمستخدم
  if (req.headers.get(BACKGROUND_HEADER) !== '1') {
    res.cookies.set(SESSION_COOKIE, await signSession(session.sub), sessionCookieOptions());
  }
  return res;
}

export const config = {
  matcher: ['/tasks/:path*', '/admin/:path*', '/login', '/api/:path*'],
};
