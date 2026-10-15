// GET /api/v1/attachments/:id — FR-07 (ضمن نطاق BR-01)
import { route } from '@/server/http';
import { downloadAttachment } from '@/server/services/attachments';

export const GET = route<{ id: string }>(async ({ user, params }) => {
  const { data, fileName, mimeType } = await downloadAttachment(user, params.id);
  return new Response(Buffer.from(data), {
    headers: {
      'content-type': mimeType,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
});
