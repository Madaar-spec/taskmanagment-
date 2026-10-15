import { prisma } from '../db';
import { unauthenticated } from '../errors';
import { readCookie, SESSION_COOKIE, verifySession } from './session';
import type { Role } from '@/lib/taskRules';

export interface SessionUser {
  id: string;
  fullNameAr: string;
  email: string;
  role: Role;
  departmentId: string;
  departmentName: string;
}

export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { department: { select: { nameAr: true } } },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    fullNameAr: user.fullNameAr,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.department.nameAr,
  };
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  const session = await verifySession(token);
  return session ? loadSessionUser(session.sub) : null;
}

/** المستخدم الحالي من ملف تعريف الجلسة في الطلب، أو 401 */
export async function requireUser(req: Request): Promise<SessionUser> {
  const user = await userFromToken(readCookie(req.headers.get('cookie'), SESSION_COOKIE));
  if (!user) throw unauthenticated();
  return user;
}
