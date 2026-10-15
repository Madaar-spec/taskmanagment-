'use client';
// FR-22: ترقيم الصفحات و«عرض X من Y»
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '@/lib/i18n';

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm text-ink-muted">
      <p data-testid="showing" aria-live="polite">
        {total === 0 ? t('tasks.showingNone') : t('tasks.showing', { from, to, total })}
      </p>
      {pages > 1 && (
        <nav aria-label={t('tasks.pageOf', { page, pages })} className="flex items-center gap-1">
          <button type="button" className="btn-icon" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('tasks.prevPage')}>
            <ChevronRight size={18} aria-hidden />
          </button>
          <span className="tabular-nums">{t('tasks.pageOf', { page, pages })}</span>
          <button type="button" className="btn-icon" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label={t('tasks.nextPage')}>
            <ChevronLeft size={18} aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}
