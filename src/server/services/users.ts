// GET /users — BR-13، وFR-31/FR-32 لإدارة المستخدمين والإدارات
import { Prisma } from '@prisma/client';
import { t } from '@/lib/i18n';
import {
  adminCreateUserSchema,
  adminDepartmentSchema,
  adminUpdateDepartmentSchema,
  adminUpdateUserSchema,
} from '@/lib/schemas';
import type { SessionUser } from '../auth/currentUser';
import { hashPassword } from '../auth/provider';
import { prisma } from '../db';
import { badRequest, forbidden, notFound } from '../errors';
import { assignableUsersWhere, visibleUsersWhere } from '../permissions';

export async function listUsers(user: SessionUser, params: URLSearchParams) {
  const purpose = params.get('purpose') === 'filter' ? 'filter' : 'assign';
  const and: Prisma.UserWhereInput[] = [purpose === 'filter' ? visibleUsersWhere(user) : assignableUsersWhere(user)];
  if (params.get('active') === 'true') and.push({ isActive: true });
  const dept = params.get('departmentId');
  if (dept && /^[0-9a-f-]{36}$/i.test(dept)) and.push({ departmentId: dept });
  const users = await prisma.user.findMany({
    where: { AND: and },
    orderBy: { fullNameAr: 'asc' },
    select: { id: true, fullNameAr: true, departmentId: true, department: { select: { nameAr: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    fullNameAr: u.fullNameAr,
    departmentId: u.departmentId,
    departmentName: u.department.nameAr,
  }));
}

// ───────── الإدارة (ADMIN فقط) ─────────

export function requireAdmin(user: SessionUser) {
  if (user.role !== 'ADMIN') throw forbidden();
}

const adminUserSelect = {
  id: true,
  fullNameAr: true,
  email: true,
  role: true,
  isActive: true,
  departmentId: true,
  department: { select: { nameAr: true } },
  createdAt: true,
} satisfies Prisma.UserSelect;

function uniqueViolation(err: unknown, field: string, message: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw badRequest(message, field);
  }
  throw err;
}

export async function adminListUsers(user: SessionUser) {
  requireAdmin(user);
  return prisma.user.findMany({ orderBy: [{ isActive: 'desc' }, { fullNameAr: 'asc' }], select: adminUserSelect });
}

async function assertDepartment(id: string) {
  const d = await prisma.department.findUnique({ where: { id }, select: { id: true } });
  if (!d) throw badRequest(t('errors.departmentRequired'), 'departmentId');
}

export async function adminCreateUser(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const input = adminCreateUserSchema.parse(raw);
  await assertDepartment(input.departmentId);
  try {
    return await prisma.user.create({
      data: {
        fullNameAr: input.fullNameAr,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        departmentId: input.departmentId,
      },
      select: adminUserSelect,
    });
  } catch (err) {
    uniqueViolation(err, 'email', t('errors.emailTaken'));
  }
}

export async function adminUpdateUser(user: SessionUser, id: string, raw: unknown) {
  requireAdmin(user);
  const input = adminUpdateUserSchema.parse(raw);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound();
  if (id === user.id && (input.isActive === false || (input.role && input.role !== 'ADMIN'))) {
    throw badRequest(t('errors.cannotDisableSelf'), input.isActive === false ? 'isActive' : 'role');
  }
  if (input.departmentId) await assertDepartment(input.departmentId);
  try {
    return await prisma.user.update({
      where: { id },
      data: {
        fullNameAr: input.fullNameAr,
        email: input.email,
        role: input.role,
        departmentId: input.departmentId,
        isActive: input.isActive,
        ...(input.password && { passwordHash: await hashPassword(input.password) }),
      },
      select: adminUserSelect,
    });
  } catch (err) {
    uniqueViolation(err, 'email', t('errors.emailTaken'));
  }
}

export async function adminListDepartments(user: SessionUser) {
  requireAdmin(user);
  const rows = await prisma.department.findMany({
    orderBy: { nameAr: 'asc' },
    include: { manager: { select: { id: true, fullNameAr: true } }, _count: { select: { users: true } } },
  });
  return rows.map((d) => ({ id: d.id, nameAr: d.nameAr, manager: d.manager, usersCount: d._count.users }));
}

async function assertManager(managerId: string | null | undefined, departmentId: string | null) {
  if (!managerId) return;
  const m = await prisma.user.findUnique({ where: { id: managerId } });
  if (!m || !m.isActive || (departmentId && m.departmentId !== departmentId)) {
    throw badRequest(t('errors.managerMustBeInDepartment'), 'managerId');
  }
}

export async function adminCreateDepartment(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const input = adminDepartmentSchema.parse(raw);
  // الإدارة الجديدة بلا موظفين بعد؛ يُشترط فقط أن يكون المدير نشطاً
  await assertManager(input.managerId, null);
  try {
    return await prisma.department.create({ data: { nameAr: input.nameAr, managerId: input.managerId ?? null } });
  } catch (err) {
    uniqueViolation(err, 'nameAr', t('errors.departmentNameTaken'));
  }
}

export async function adminUpdateDepartment(user: SessionUser, id: string, raw: unknown) {
  requireAdmin(user);
  const input = adminUpdateDepartmentSchema.parse(raw);
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw notFound();
  await assertManager(input.managerId, id);
  try {
    return await prisma.department.update({
      where: { id },
      data: { nameAr: input.nameAr, managerId: input.managerId === undefined ? undefined : input.managerId },
    });
  } catch (err) {
    uniqueViolation(err, 'nameAr', t('errors.departmentNameTaken'));
  }
}
