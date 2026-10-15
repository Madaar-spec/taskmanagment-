// /api/v1/admin/users — FR-31 (ADMIN فقط)
import { json, readJson, route } from '@/server/http';
import { adminCreateUser, adminListUsers } from '@/server/services/users';

export const GET = route(async ({ user }) => adminListUsers(user));
export const POST = route(async ({ req, user }) => json(await adminCreateUser(user, await readJson(req)), 201));
