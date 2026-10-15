// GET/POST /api/v1/tasks — FR-04، FR-15..FR-22، BR-01، BR-02، BR-03، BR-04، BR-08، BR-11..BR-13
import { json, queryObject, readJson, route } from '@/server/http';
import { createTask, listTasks } from '@/server/services/tasks';

export const GET = route(async ({ req, user, today }) => listTasks(user, queryObject(req), today));

export const POST = route(async ({ req, user, today }) => json(await createTask(user, await readJson(req), today), 201));
