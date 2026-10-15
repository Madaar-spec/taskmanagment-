// GET /api/v1/notifications — FR-28
import { route } from '@/server/http';
import { listNotifications } from '@/server/services/notifications';

export const GET = route(async ({ user }) => listNotifications(user));
