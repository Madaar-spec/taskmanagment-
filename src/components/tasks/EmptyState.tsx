'use client';
// FR-23: حالة فارغة مع «إعادة ضبط التصفية»
import { RotateCcw, SearchX } from 'lucide-react';
import { t } from '@/lib/i18n';

export function EmptyState({ canReset, onReset }: { canReset: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center" data-testid="empty-state">
      <SearchX size={40} aria-hidden className="text-ink-muted" />
      <p className="text-base font-medium">{canReset ? t('tasks.empty') : t('tasks.emptyScope')}</p>
      {canReset && (
        <>
          <p className="text-sm text-ink-muted">{t('tasks.emptyHint')}</p>
          <button type="button" className="btn-primary mt-2" onClick={onReset} data-testid="reset-filters">
            <RotateCcw size={16} aria-hidden />
            {t('tasks.filters.reset')}
          </button>
        </>
      )}
    </div>
  );
}
