// FR-07: المرفقات (حتى 25 ميجابايت للملف)
import { t } from '@/lib/i18n';
import { isLocked, MAX_ATTACHMENT_BYTES } from '@/lib/taskRules';
import type { SessionUser } from '../auth/currentUser';
import { prisma } from '../db';
import { badRequest, forbidden, notFound, ruleError } from '../errors';
import { canEditTask, scopeTasks } from '../permissions';
import { newStorageKey, storage } from '../storage';
import { loadTask } from './tasks';

export async function uploadAttachment(user: SessionUser, code: string, file: File | null) {
  if (!file || file.size === 0) throw badRequest(t('errors.fileRequired'), 'file');
  if (file.size > MAX_ATTACHMENT_BYTES) throw ruleError('FR-07', t('errors.fileTooLarge'), 'file');
  const task = await loadTask(prisma, user, code);
  if (!canEditTask(user, task)) throw forbidden();
  if (isLocked(task.status)) throw ruleError('BR-10', t('errors.taskLocked'));

  const fileName = (file.name || 'file').slice(0, 255);
  const mimeType = (file.type || 'application/octet-stream').slice(0, 100);
  const key = newStorageKey(task.id, fileName);
  await storage().put(key, new Uint8Array(await file.arrayBuffer()), mimeType);
  const a = await prisma.attachment.create({
    data: { taskId: task.id, fileName, mimeType, sizeBytes: file.size, storageKey: key, uploadedById: user.id },
    include: { uploadedBy: { select: { id: true, fullNameAr: true } } },
  });
  return {
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    uploadedBy: a.uploadedBy,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function downloadAttachment(user: SessionUser, id: string) {
  const a = await prisma.attachment.findFirst({ where: { id, task: scopeTasks(user) } });
  if (!a) throw notFound();
  const data = await storage().get(a.storageKey);
  return { data, fileName: a.fileName, mimeType: a.mimeType };
}
