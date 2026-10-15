// POST /api/v1/tasks/:code/attachments (multipart) — FR-07
import { badRequest } from '@/server/errors';
import { json, route } from '@/server/http';
import { uploadAttachment } from '@/server/services/attachments';

export const POST = route<{ code: string }>(async ({ req, user, params }) => {
  const form = await req.formData().catch(() => {
    throw badRequest();
  });
  const file = form.get('file');
  return json(await uploadAttachment(user, params.code, file instanceof File ? file : null), 201);
});
