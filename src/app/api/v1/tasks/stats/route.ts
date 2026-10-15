// GET /api/v1/tasks/stats — FR-20، FR-25، FR-26، FR-27، BR-16
import { queryObject, route } from '@/server/http';
import { getStats } from '@/server/services/tasks';

export const GET = route(async ({ req, user, today }) => getStats(user, queryObject(req), today));
