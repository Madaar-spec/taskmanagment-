// GET /api/v1/me — FR-02
import { route } from '@/server/http';

export const GET = route(async ({ user, today }) => ({ user, today }));
