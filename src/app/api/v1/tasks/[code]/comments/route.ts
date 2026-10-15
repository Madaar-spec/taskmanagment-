// POST /api/v1/tasks/:code/comments — FR-10، BR-15، BR-17
import { json, readJson, route } from '@/server/http';
import { addComment } from '@/server/services/comments';

export const POST = route<{ code: string }>(async ({ req, user, params }) =>
  json(await addComment(user, params.code, await readJson(req)), 201),
);
