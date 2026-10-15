// POST /api/v1/tasks/:code/transition — BR-05 إلى BR-09
import { readJson, route } from '@/server/http';
import { transitionTask } from '@/server/services/tasks';

export const POST = route<{ code: string }>(async ({ req, user, params }) =>
  transitionTask(user, params.code, await readJson(req)),
);
