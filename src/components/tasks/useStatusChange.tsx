'use client';
// تغيير الحالة من التفاصيل أو اللوحة (FR-08، FR-14، FR-17، FR-29)
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { checkTransition, findTransition, type Role, type Status } from '@/lib/taskRules';
import { useInvalidateTasks } from '../hooks';
import { useToast } from '../ui/Toast';
import { ReasonDialog } from './ReasonDialog';

interface Pending {
  code: string;
  from: Status;
  to: Status;
}

export function useStatusChange(role: Role) {
  const toast = useToast();
  const invalidate = useInvalidateTasks();
  const [pending, setPending] = useState<Pending | null>(null);

  async function send(code: string, to: Status, reason?: string) {
    try {
      await api(`/tasks/${code}/transition`, { method: 'POST', body: { to, reason } });
      toast(t('toast.statusChanged', { code, status: t(`status.${to}`) }));
      await invalidate(code);
      return true;
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('errors.INTERNAL'), 'error');
      await invalidate(code);
      return false;
    }
  }

  /** يطلب السبب عند الحاجة (BR-09)، ويُظهر رسالة BR-05 للانتقال غير المسموح فوراً */
  async function change(code: string, from: Status, to: Status) {
    const rule = findTransition(from, to);
    if (!rule) {
      const v = checkTransition({ from, to, role, canChangeStatus: true, subtasks: [] });
      toast(v!.message, 'error');
      return false;
    }
    if (rule.requiresReason) {
      setPending({ code, from, to });
      return false;
    }
    return send(code, to);
  }

  const dialog = (
    <ReasonDialog
      open={!!pending}
      reopen={pending?.from === 'DONE'}
      onCancel={() => setPending(null)}
      onConfirm={async (reason) => {
        if (!pending) return;
        const ok = await send(pending.code, pending.to, reason);
        if (ok) setPending(null);
      }}
    />
  );

  return { change, dialog };
}
