// /api/v1/admin/departments/:id — FR-32
import { readJson, route } from '@/server/http';
import { adminUpdateDepartment } from '@/server/services/users';

export const PATCH = route<{ id: string }>(async ({ req, user, params }) =>
  adminUpdateDepartment(user, params.id, await readJson(req)),
);
