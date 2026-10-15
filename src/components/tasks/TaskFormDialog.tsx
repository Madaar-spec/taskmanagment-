'use client';
// FR-04 إلى FR-07، FR-13: نافذة «مهمة جديدة / تعديل»
import { Paperclip, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { createTaskSchema, fieldErrors, updateTaskSchema } from '@/lib/schemas';
import { isDueDateAllowed, LIMITS, MAX_ATTACHMENT_BYTES, PRIORITIES } from '@/lib/taskRules';
import type { TaskDetail } from '@/lib/types';
import { useInvalidateTasks, useUsers } from '../hooks';
import { useSession } from '../shell/AppProviders';
import { Modal } from '../ui/Dialog';
import { useToast } from '../ui/Toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** وضع التعديل */
  task?: TaskDetail | null;
  onCreated?: (code: string) => void;
}

function omit(obj: Record<string, string>, key: string) {
  const next = { ...obj };
  delete next[key];
  return next;
}

interface FormState {
  title: string;
  description: string;
  assigneeId: string;
  priority: string;
  dueDate: string;
  requestRef: string;
}

export function TaskFormDialog({ open, onOpenChange, task, onCreated }: Props) {
  const { user, today } = useSession();
  const users = useUsers('assign');
  const toast = useToast();
  const invalidate = useInvalidateTasks();
  const editing = !!task;

  const initial = (): FormState => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    assigneeId: task?.assignee.id ?? user.id,
    priority: task?.priority ?? 'MEDIUM',
    dueDate: task?.dueDate ?? today,
    requestRef: task?.requestRef ?? '',
  });
  const [form, setForm] = useState<FormState>(initial);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSub, setNewSub] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial());
      setSubtasks([]);
      setNewSub('');
      setFiles([]);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function addSub() {
    const text = newSub.trim();
    if (!text) return;
    if (subtasks.length >= LIMITS.subtasksPerTask) {
      setErrors((e) => ({ ...e, subtasks: t('errors.subtaskLimit') }));
      return;
    }
    if (text.length > LIMITS.subtaskMax) {
      setErrors((e) => ({ ...e, subtasks: t('errors.subtaskTooLong') }));
      return;
    }
    setSubtasks((s) => [...s, text]);
    setNewSub('');
    setErrors((e) => omit(e, 'subtasks'));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) setErrors((e) => ({ ...e, files: t('errors.fileTooLarge') }));
    else setErrors((e) => omit(e, 'files'));
    setFiles((fs) => [...fs, ...picked.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, subtasks };
    const parsed = editing
      ? updateTaskSchema.safeParse({ ...form, updatedAt: task!.updatedAt })
      : createTaskSchema.safeParse(payload);
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    // BR-03 (تُكرَّر في الواجهة للتجربة فقط)
    if (!errs.dueDate && form.dueDate && !isDueDateAllowed(form.dueDate, today) && (!editing || form.dueDate !== task!.dueDate)) {
      errs.dueDate = t('errors.duePast');
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.getElementById(`tf-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (editing) {
        const body: Record<string, unknown> = { updatedAt: task!.updatedAt };
        (Object.keys(form) as (keyof FormState)[]).forEach((k) => {
          const before = k === 'description' || k === 'requestRef' ? (task![k] ?? '') : k === 'assigneeId' ? task!.assignee.id : task![k];
          if (form[k] !== before) body[k] = form[k];
        });
        await api(`/tasks/${task!.code}`, { method: 'PATCH', body });
        toast(t('toast.updated'));
        await invalidate(task!.code);
      } else {
        const created = await api<{ code: string }>('/tasks', { method: 'POST', body: payload });
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          await api(`/tasks/${created.code}/attachments`, { method: 'POST', form: fd }).catch((err) =>
            toast(err instanceof ApiError ? err.message : t('errors.INTERNAL'), 'error'),
          );
        }
        toast(t('toast.created', { code: created.code }));
        await invalidate();
        onCreated?.(created.code);
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.field) setErrors({ [err.field]: err.message });
        else toast(err.message, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <p id={`tf-${k}-error`} className="field-error">
        {errors[k]}
      </p>
    ) : null;
  const aria = (k: string) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `tf-${k}-error` : undefined });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? t('form.editTitle', { code: task!.code }) : t('form.createTitle')} size="lg">
      <form onSubmit={submit} noValidate className="space-y-4" data-testid="task-form">
        <div>
          <label htmlFor="tf-title" className="label">
            {t('form.title')} <span className="text-danger" aria-hidden>*</span>
            <span className="sr-only">({t('form.required')})</span>
          </label>
          <input id="tf-title" className="field" value={form.title} onChange={update('title')} maxLength={LIMITS.titleMax + 20} {...aria('title')} />
          {err('title')}
        </div>
        <div>
          <label htmlFor="tf-description" className="label">
            {t('form.description')}
          </label>
          <textarea id="tf-description" rows={3} className="field" value={form.description} onChange={update('description')} {...aria('description')} />
          {err('description')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tf-assigneeId" className="label">
              {t('form.assignee')}
            </label>
            <select id="tf-assigneeId" className="field" value={form.assigneeId} onChange={update('assigneeId')} {...aria('assigneeId')}>
              {!users.data?.some((u) => u.id === form.assigneeId) && task && (
                <option value={task.assignee.id}>{task.assignee.fullNameAr}</option>
              )}
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullNameAr} — {u.departmentName}
                </option>
              ))}
            </select>
            {err('assigneeId')}
          </div>
          <div>
            <label htmlFor="tf-priority" className="label">
              {t('form.priority')}
            </label>
            <select id="tf-priority" className="field" value={form.priority} onChange={update('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tf-dueDate" className="label">
              {t('form.due')} <span className="text-danger" aria-hidden>*</span>
            </label>
            <input id="tf-dueDate" type="date" min={today} className="field" value={form.dueDate} onChange={update('dueDate')} {...aria('dueDate')} />
            {err('dueDate')}
          </div>
          <div>
            <label htmlFor="tf-requestRef" className="label">
              {t('form.requestRef')}
            </label>
            <input
              id="tf-requestRef"
              dir="ltr"
              className="field text-start"
              placeholder="REQ-2026-0000"
              value={form.requestRef}
              onChange={update('requestRef')}
              {...aria('requestRef')}
              aria-describedby={errors.requestRef ? 'tf-requestRef-error' : 'tf-requestRef-hint'}
            />
            <p id="tf-requestRef-hint" className="mt-1 text-xs text-ink-muted">
              {t('form.requestRefHint')}
            </p>
            {err('requestRef')}
          </div>
        </div>

        {!editing && (
          <>
            <fieldset>
              <legend className="label">{t('form.subtasks')}</legend>
              {subtasks.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {subtasks.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-field border border-border px-3">
                      <span className="flex-1 py-2 text-sm">{s}</span>
                      <button
                        type="button"
                        className="btn-icon"
                        aria-label={t('form.removeSubtask', { text: s })}
                        onClick={() => setSubtasks((xs) => xs.filter((_, j) => j !== i))}
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <label htmlFor="tf-newsub" className="sr-only">
                  {t('details.addSubtaskPlaceholder')}
                </label>
                <input
                  id="tf-newsub"
                  className="field"
                  value={newSub}
                  placeholder={t('details.addSubtaskPlaceholder')}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSub();
                    }
                  }}
                  {...aria('subtasks')}
                />
                <button type="button" className="btn-secondary shrink-0" onClick={addSub}>
                  <Plus size={16} aria-hidden /> {t('form.addSubtask')}
                </button>
              </div>
              {err('subtasks')}
            </fieldset>
            <div>
              <label htmlFor="tf-files" className="label">
                {t('form.attachments')}
              </label>
              <input id="tf-files" type="file" multiple className="field file:me-3 file:rounded-pill file:border-0 file:bg-primary file:px-3 file:py-1 file:text-ink" onChange={(e) => addFiles(e.target.files)} aria-describedby="tf-files-hint" />
              <p id="tf-files-hint" className="mt-1 text-xs text-ink-muted">
                {t('form.attachmentsHint')}
              </p>
              {err('files')}
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Paperclip size={14} aria-hidden className="text-ink-muted" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button type="button" className="btn-icon" aria-label={t('form.removeAttachment', { name: f.name })} onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))}>
                        <X size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy} data-testid="submit-task">
            {busy ? t('form.saving') : editing ? t('form.save') : t('form.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
