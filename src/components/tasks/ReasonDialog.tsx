'use client';
// FR-14، BR-09: سبب الإعادة — حقل نصي إلزامي + تأكيد
import { useState } from 'react';
import { t } from '@/lib/i18n';
import { isValidReason } from '@/lib/taskRules';
import { Modal } from '../ui/Dialog';

export function ReasonDialog({
  open,
  reopen,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  reopen: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidReason(reason)) {
      setError(t('errors.reasonRequired'));
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      setError(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason('');
          setError(null);
          onCancel();
        }
      }}
      title={reopen ? t('reason.reopenTitle') : t('reason.title')}
      size="sm"
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="reason" className="label">
            {t('reason.label')} <span className="text-danger">*</span>
          </label>
          <textarea
            id="reason"
            rows={4}
            className="field"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? 'reason-hint reason-error' : 'reason-hint'}
            autoFocus
          />
          <p id="reason-hint" className="mt-1 text-xs text-ink-muted">
            {t('reason.hint')}
          </p>
          {error && (
            <p id="reason-error" className="field-error">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('reason.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {t('reason.confirm')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
