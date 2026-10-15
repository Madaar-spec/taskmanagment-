// PATCH/DELETE /api/v1/subtasks/:id — FR-09، BR-08، BR-10
import { readJson, route } from '@/server/http';
import { deleteSubtask, updateSubtask } from '@/server/services/subtasks';

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => updateSubtask(user, params.id, await readJson(req)));

export const DELETE = route<P>(async ({ user, params }) => deleteSubtask(user, params.id));
