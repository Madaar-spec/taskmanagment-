// /api/v1/admin/departments — FR-32 (ADMIN فقط)
import { json, readJson, route } from '@/server/http';
import { adminCreateDepartment, adminListDepartments } from '@/server/services/users';

export const GET = route(async ({ user }) => adminListDepartments(user));
export const POST = route(async ({ req, user }) => json(await adminCreateDepartment(user, await readJson(req)), 201));
