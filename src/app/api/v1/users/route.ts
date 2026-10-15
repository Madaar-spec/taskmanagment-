// GET /api/v1/users?active=true&departmentId=&purpose=assign|filter — BR-13
import { route } from '@/server/http';
import { listUsers } from '@/server/services/users';

export const GET = route(async ({ req, user }) => listUsers(user, new URL(req.url).searchParams));
