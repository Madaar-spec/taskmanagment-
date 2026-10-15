// /api/v1/admin/users/:id — FR-31 (التعطيل بدل الحذف للحفاظ على مسار التدقيق)
import { readJson, route } from '@/server/http';
import { adminUpdateUser } from '@/server/services/users';

export const PATCH = route<{ id: string }>(async ({ req, user, params }) =>
  adminUpdateUser(user, params.id, await readJson(req)),
);
