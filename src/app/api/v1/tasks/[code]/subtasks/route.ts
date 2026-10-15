// POST /api/v1/tasks/:code/subtasks — FR-06، BR-10، BR-17
import { json, readJson, route } from '@/server/http';
import { addSubtask } from '@/server/services/subtasks';

export const POST = route<{ code: string }>(async ({ req, user, params }) =>
  json(await addSubtask(user, params.code, await readJson(req)), 201),
);
