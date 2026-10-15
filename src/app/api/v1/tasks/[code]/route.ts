// GET/PATCH/DELETE /api/v1/tasks/:code — BR-01، BR-05، BR-10، BR-13، BR-14
import { readJson, route } from '@/server/http';
import { deleteTask, getTask, updateTask } from '@/server/services/tasks';

type P = { code: string };

export const GET = route<P>(async ({ user, params, today }) => getTask(user, params.code, today));

export const PATCH = route<P>(async ({ req, user, params, today }) =>
  updateTask(user, params.code, await readJson(req), today),
);

export const DELETE = route<P>(async ({ user, params }) => deleteTask(user, params.code));
