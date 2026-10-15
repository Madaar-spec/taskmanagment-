'use client';
// لوحة تفاصيل المهمة — FR-08 إلى FR-14 (تنزلق من اليسار بعرض 560px)
import * as D from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { Download, Lock, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { commentSchema, fieldErrors } from '@/lib/schemas';
import { computeProgress, dueLabel, MAX_ATTACHMENT_BYTES, type PriorityLevel, type Status } from '@/lib/taskRules';
import type { TaskDetail } from '@/lib/types';
import { useInvalidateTasks, useTask } from '../hooks';
import { useSession } from '../shell/AppProviders';
import { PriorityBadge, StatusBadge } from '../ui/Badges';
import { Modal } from '../ui/Dialog';
import { ProgressBar } from '../ui/Progress';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { TaskFormDialog } from './TaskFormDialog';
import { useStatusChange } from './useStatusChange';

type Activity = TaskDetail['activities'][number];

/** نص سطر النشاط — AC-10: «غيّر [الاسم] الحالة إلى «…»» */
export function activityText(a: Activity): string {
  const actor = a.actor.fullNameAr;
  const nv = (a.newValue ?? {}) as Record<string, unknown>;
  const ov = (a.oldValue ?? {}) as Record<string, unknown>;
  switch (a.type) {
    case 'CREATED':
      return t('activity.CREATED', { actor });
    case 'STATUS_CHANGED':
      return t('activity.STATUS_CHANGED', { actor, to: t(`status.${nv.status as Status}`) });
    case 'REOPENED':
      return t('activity.REOPENED', { actor });
    case 'ASSIGNEE_CHANGED':
      return t('activity.ASSIGNEE_CHANGED', { actor, from: String(ov.name ?? ''), to: String(nv.name ?? '') });
    case 'PRIORITY_CHANGED':
      return t('activity.PRIORITY_CHANGED', {
        actor,
        from: t(`priority.${ov.priority as PriorityLevel}`),
        to: t(`priority.${nv.priority as PriorityLevel}`),
      });
    case 'DUE_CHANGED':
      return t('activity.DUE_CHANGED', { actor, from: formatDate(String(ov.dueDate)), to: formatDate(String(nv.dueDate)) });
    case 'SUBTASK_TOGGLED':
      return t(nv.isDone ? 'activity.SUBTASK_DONE' : 'activity.SUBTASK_UNDONE', { actor, text: String(nv.text ?? '') });
    case 'COMMENT':
    default:
      return t('activity.COMMENT', { actor });
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TaskDetailsPanel({ code, onClose }: { code: string | null; onClose: () => void }) {
  const { data: task, isLoading, error } = useTask(code);
  return (
    <D.Root open={!!code} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="overlay fixed inset-0 z-50 bg-black/50" />
        <D.Content
          dir="rtl"
          aria-describedby={undefined}
          data-testid="task-panel"
          className="panel-content fixed inset-y-0 left-0 z-50 flex w-full max-w-[560px] flex-col border-e border-border bg-surface-2 shadow-2xl"
        >
          {task ? (
            <PanelBody task={task} onClose={onClose} />
          ) : (
            <div className="flex-1 p-5">
              <div className="flex items-center justify-between">
                <D.Title className="font-mono text-sm text-accent">{code}</D.Title>
                <D.Close className="btn-icon" aria-label={t('details.close')}>
                  <X size={20} aria-hidden />
                </D.Close>
              </div>
              {isLoading ? (
                <div role="status" aria-label={t('common.loading')} className="mt-4 space-y-3">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : error ? (
                <p className="mt-6 text-ink-muted">{t('details.notFound')}</p>
              ) : null}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function PanelBody({ task, onClose }: { task: TaskDetail; onClose: () => void }) {
  const { user, today } = useSession();
  const toast = useToast();
  const invalidate = useInvalidateTasks();
  const { change, dialog } = useStatusChange(user.role);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const locked = task.status === 'DONE';

  async function run<T>(fn: () => Promise<T>, success?: string) {
    try {
      const r = await fn();
      if (success) toast(success);
      await invalidate(task.code);
      return r;
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('errors.INTERNAL'), 'error');
      await invalidate(task.code);
      return undefined;
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <D.Title className="font-mono text-sm font-semibold text-accent" dir="ltr">
          {task.code}
        </D.Title>
        <StatusBadge status={task.status} />
        <div className="ms-auto flex items-center gap-1">
          {task.permissions.edit && (
            <button type="button" className="btn-icon" onClick={() => setEditOpen(true)} aria-label={t('details.edit')} data-testid="edit-task">
              <Pencil size={18} aria-hidden />
            </button>
          )}
          {task.permissions.delete && (
            <button type="button" className="btn-icon hover:text-danger" onClick={() => setDeleteOpen(true)} aria-label={t('details.delete')}>
              <Trash2 size={18} aria-hidden />
            </button>
          )}
          <D.Close className="btn-icon" aria-label={t('details.close')}>
            <X size={20} aria-hidden />
          </D.Close>
        </div>
      </div>

      <div className="relative flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <h2 className="text-xl font-semibold leading-snug" data-testid="panel-title">
            {task.title}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{task.description || t('details.noDescription')}</p>
          {locked && (
            <p className="mt-3 flex items-center gap-2 rounded-field border border-st-done/40 bg-st-done/10 px-3 py-2 text-sm">
              <Lock size={16} aria-hidden className="text-st-done" /> {t('details.lockedNote')}
            </p>
          )}
        </section>

        <section aria-labelledby="sec-fields">
          <h3 id="sec-fields" className="section-title mb-3">
            {t('details.fields')}
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label={t('details.assignee')}>{task.assignee.fullNameAr}</Field>
            <Field label={t('details.department')}>{task.department.nameAr}</Field>
            <Field label={t('details.priority')}>
              <PriorityBadge priority={task.priority} />
            </Field>
            <Field label={t('details.due')}>
              {formatDate(task.dueDate)}
              <span className={clsx('block text-xs', task.isOverdue ? 'text-pr-high' : 'text-ink-muted')} data-testid="panel-due-label">
                {dueLabel(task.status, task.dueDate, today)}
              </span>
            </Field>
            <Field label={t('details.requestRef')}>
              {task.requestRef ? <span dir="ltr">{task.requestRef}</span> : <span className="text-ink-muted">{t('details.noRequest')}</span>}
            </Field>
            <Field label={t('details.createdBy')}>
              {task.createdBy.fullNameAr}
              <span className="block text-xs text-ink-muted">{formatDateTime(task.createdAt)}</span>
            </Field>
          </dl>
        </section>

        {/* FR-08: أزرار تغيير الحالة — المسموح بها فقط مفعّلة */}
        {task.allowedTransitions.length > 0 && (
          <section aria-labelledby="sec-status">
            <h3 id="sec-status" className="section-title mb-3">
              {t('details.changeStatus')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {task.allowedTransitions.map((tr) => {
                const reasonId = `blocked-${tr.to}`;
                return (
                  <div key={tr.to}>
                    <button
                      type="button"
                      className={tr.to === 'DONE' ? 'btn-primary' : 'btn-secondary'}
                      disabled={!tr.allowed}
                      aria-describedby={!tr.allowed || tr.warning ? reasonId : undefined}
                      onClick={() => change(task.code, task.status, tr.to)}
                      data-testid={`transition-${tr.to}`}
                    >
                      {t(`transition.${task.status}>${tr.to}`)}
                    </button>
                    {(!tr.allowed || tr.warning) && (
                      <p id={reasonId} className="mt-1 max-w-[16rem] text-xs text-ink-muted">
                        {tr.blockedBy === 'BR-07'
                          ? t('errors.doneRequiresManager')
                          : tr.blockedBy === 'BR-09'
                            ? t('errors.reopenRequiresManager')
                            : tr.blockedBy
                              ? t('errors.FORBIDDEN')
                              : t('details.blockedSubtasks')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Subtasks task={task} run={run} />
        <Attachments task={task} run={run} />
        <Timeline task={task} />
      </div>

      {task.permissions.comment && <CommentBox task={task} run={run} />}

      {dialog}
      <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
      <Modal open={deleteOpen} onOpenChange={setDeleteOpen} title={t('details.deleteConfirmTitle', { code: task.code })} size="sm">
        <p className="text-sm text-ink-muted">{t('details.deleteConfirmBody')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setDeleteOpen(false)}>
            {t('form.cancel')}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={async () => {
              const ok = await run(() => api(`/tasks/${task.code}`, { method: 'DELETE' }), t('toast.deleted', { code: task.code }));
              if (ok) {
                setDeleteOpen(false);
                onClose();
              }
            }}
          >
            {t('details.confirmDelete')}
          </button>
        </div>
      </Modal>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

type Run = <T>(fn: () => Promise<T>, success?: string) => Promise<T | undefined>;

function Subtasks({ task, run }: { task: TaskDetail; run: Run }) {
  const [text, setText] = useState('');
  // FR-09: تحديث فوري (متفائل) لمربع الاختيار ونسبة التقدم (BR-08) حتى يرد الخادم
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const subtasks = task.subtasks.map((s) => (s.id in pending ? { ...s, isDone: pending[s.id]! } : s));
  const progress = computeProgress(task.status, subtasks);

  async function toggle(id: string, isDone: boolean) {
    setPending((p) => ({ ...p, [id]: isDone }));
    await run(() => api(`/subtasks/${id}`, { method: 'PATCH', body: { isDone } }));
    setPending((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }
  const [error, setError] = useState<string | null>(null);
  const done = subtasks.filter((s) => s.isDone).length;
  const editable = task.permissions.subtasks;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return setError(t('errors.subtaskRequired'));
    if (value.length > 200) return setError(t('errors.subtaskTooLong'));
    setError(null);
    const ok = await run(() => api(`/tasks/${task.code}/subtasks`, { method: 'POST', body: { text: value } }));
    if (ok) setText('');
  }

  return (
    <section aria-labelledby="sec-subtasks">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id="sec-subtasks" className="section-title">
          {t('details.subtasks')}
        </h3>
        {task.subtasks.length > 0 && (
          <span className="text-xs text-ink-muted">{t('details.subtasksProgress', { done, total: task.subtasks.length })}</span>
        )}
      </div>
      <div className="mb-3" data-testid="panel-progress">
        <ProgressBar value={progress} />
      </div>
      {subtasks.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('details.noSubtasks')}</p>
      ) : (
        <ul className="space-y-1">
          {subtasks.map((s) => (
            <li key={s.id} className="group flex items-center gap-1 rounded-field hover:bg-bg/40">
              <label className="flex min-h-touch flex-1 cursor-pointer items-center gap-3 px-2">
                <input
                  type="checkbox"
                  checked={s.isDone}
                  disabled={!editable}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[#49BAA6]"
                />
                <span className={clsx('text-sm', s.isDone && 'text-ink-muted line-through')}>{s.text}</span>
              </label>
              {editable && (
                <button
                  type="button"
                  className="btn-icon opacity-70 hover:text-danger group-hover:opacity-100"
                  aria-label={t('details.deleteSubtask', { text: s.text })}
                  onClick={() => run(() => api(`/subtasks/${s.id}`, { method: 'DELETE' }))}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form onSubmit={add} noValidate className="mt-2">
          <div className="flex gap-2">
            <label htmlFor="new-subtask" className="sr-only">
              {t('details.addSubtask')}
            </label>
            <input
              id="new-subtask"
              className="field"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('details.addSubtaskPlaceholder')}
              aria-invalid={!!error}
              aria-describedby={error ? 'new-subtask-error' : undefined}
            />
            <button type="submit" className="btn-secondary shrink-0" aria-label={t('details.addSubtask')}>
              <Plus size={16} aria-hidden />
            </button>
          </div>
          {error && (
            <p id="new-subtask-error" className="field-error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function Attachments({ task, run }: { task: TaskDetail; run: Run }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast(t('errors.fileTooLarge'), 'error');
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    await run(() => api(`/tasks/${task.code}/attachments`, { method: 'POST', form: fd }), t('toast.uploaded'));
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  return (
    <section aria-labelledby="sec-files">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="sec-files" className="section-title">
          {t('details.attachments')}
        </h3>
        {task.permissions.attach && (
          <>
            <input ref={input} id="attach-file" type="file" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            <label htmlFor="attach-file" className={clsx('btn-secondary cursor-pointer', busy && 'pointer-events-none opacity-60')}>
              <Paperclip size={16} aria-hidden /> {busy ? t('details.uploading') : t('details.upload')}
            </label>
          </>
        )}
      </div>
      {task.attachments.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('details.noAttachments')}</p>
      ) : (
        <ul className="space-y-1">
          {task.attachments.map((f) => (
            <li key={f.id}>
              <a
                href={`/api/v1/attachments/${f.id}`}
                className="flex min-h-touch items-center gap-3 rounded-field px-2 hover:bg-bg/40"
                aria-label={t('details.download', { name: f.fileName })}
              >
                <Download size={16} aria-hidden className="text-accent" />
                <span className="flex-1 truncate text-sm">{f.fileName}</span>
                <span className="text-xs text-ink-muted" dir="ltr">
                  {formatSize(f.sizeBytes)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** FR-12: التعليقات وسجل النشاط في خط زمني واحد تصاعدي */
function Timeline({ task }: { task: TaskDetail }) {
  return (
    <section aria-labelledby="sec-timeline">
      <h3 id="sec-timeline" className="section-title mb-3">
        {t('details.timeline')}
      </h3>
      <ol className="relative space-y-4 border-s border-border ps-5" data-testid="timeline">
        {task.activities.map((a) => (
          <li key={a.id} className="relative" data-type={a.type}>
            <span
              aria-hidden
              className={clsx(
                'absolute -start-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface-2',
                a.type === 'COMMENT' ? 'bg-accent' : 'bg-border-strong',
              )}
            />
            <p className="text-sm">{activityText(a)}</p>
            <time className="text-xs text-ink-muted" dateTime={a.createdAt}>
              {formatDateTime(a.createdAt)}
            </time>
            {a.body && (
              <p
                className={clsx(
                  'mt-1.5 whitespace-pre-line rounded-field px-3 py-2 text-sm',
                  a.type === 'COMMENT' ? 'bg-bg/60' : 'border border-st-progress/40 bg-st-progress/10',
                )}
              >
                {a.type !== 'COMMENT' ? t('activity.reason', { reason: a.body }) : a.body}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CommentBox({ task, run }: { task: TaskDetail; run: Run }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = commentSchema.safeParse({ body });
    if (!parsed.success) return setError(fieldErrors(parsed.error).body ?? null);
    setError(null);
    const ok = await run(() => api(`/tasks/${task.code}/comments`, { method: 'POST', body: parsed.data }), t('toast.commentAdded'));
    if (ok) setBody('');
  }
  return (
    <form onSubmit={submit} noValidate className="border-t border-border p-4">
      <label htmlFor="comment" className="sr-only">
        {t('details.commentLabel')}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="comment"
          rows={2}
          className="field resize-none"
          placeholder={t('details.commentPlaceholder')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'comment-error' : undefined}
        />
        <button type="submit" className="btn-primary shrink-0" data-testid="send-comment">
          {t('details.sendComment')}
        </button>
      </div>
      {error && (
        <p id="comment-error" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}
