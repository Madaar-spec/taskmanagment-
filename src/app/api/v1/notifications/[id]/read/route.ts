// POST /api/v1/notifications/:id/read — FR-28
import { route } from '@/server/http';
import { markNotificationRead } from '@/server/services/notifications';

export const POST = route<{ id: string }>(async ({ user, params }) => markNotificationRead(user, params.id));
