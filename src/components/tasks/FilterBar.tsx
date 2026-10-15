'use client';
// FR-18، FR-19: البحث والتصفية + مبدّل «قائمة / لوحة»
import clsx from 'clsx';
import { Columns3, List, RotateCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import { PRIORITIES, STATUSES } from '@/lib/taskRules';
import type { TaskStats } from '@/lib/types';
import { useUsers } from '../hooks';
import { STATUS_DOT } from '../ui/Badges';
import type { useTaskParams } from './useTaskParams';

type TP = ReturnType<typeof useTaskParams>;

export function FilterBar({ tp, byStatus }: { tp: TP; byStatus: TaskStats['byStatus'] | undefined }) {
  const { params, set, hasFilters, resetFilters } = tp;
  const users = useUsers('filter');
  const [q, setQ] = useState(params.q ?? '');

  // مزامنة حقل البحث مع الرابط (مع تأخير بسيط أثناء الكتابة)
  useEffect(() => setQ(params.q ?? ''), [params.q]);
  useEffect(() => {
    if ((params.q ?? '') === q.trim()) return;
    const id = setTimeout(() => set({ q: q.trim() || undefined }, { resetPage: true }), 300);
    return () => clearTimeout(id);
  }, [q, params.q, set]);

  const total = byStatus ? STATUSES.reduce((s, k) => s + byStatus[k], 0) : undefined;
  const chips = [{ key: undefined, label: t('tasks.filters.statusAll'), count: total }].concat(
    STATUSES.map((s) => ({ key: s, label: t(`status.${s}`), count: byStatus?.[s] })) as never[],
  ) as { key: string | undefined; label: string; count: number | undefined }[];

  return (
    <section className="card space-y-3 p-3 sm:p-4" aria-label={t('tasks.filters.search')}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <label htmlFor="task-search" className="sr-only">
            {t('tasks.filters.search')}
          </label>
          <Search size={18} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            id="task-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('tasks.filters.searchPlaceholder')}
            className="field ps-10"
            data-testid="search"
          />
        </div>
        <div role="group" aria-label={t('tasks.filters.modeGroup')} className="flex rounded-pill border border-border-strong p-0.5">
          {(['list', 'board'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={params.mode === m}
              onClick={() => set({ mode: m })}
              data-testid={`mode-${m}`}
              className={clsx(
                'inline-flex min-h-[40px] items-center gap-1.5 rounded-pill px-4 text-sm',
                params.mode === m ? 'bg-primary text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {m === 'list' ? <List size={16} aria-hidden /> : <Columns3 size={16} aria-hidden />}
              {t(m === 'list' ? 'tasks.filters.modeList' : 'tasks.filters.modeBoard')}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-label={t('tasks.filters.statusGroup')} className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = (params.status ?? undefined) === c.key;
          return (
            <button
              key={c.key ?? 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => set({ status: c.key }, { resetPage: true })}
              data-testid={`chip-${c.key ?? 'ALL'}`}
              className={clsx(
                'inline-flex min-h-touch items-center gap-2 rounded-pill border px-4 text-sm transition-colors',
                active ? 'border-accent bg-primary/40 text-ink' : 'border-border-strong text-ink-muted hover:text-ink',
              )}
            >
              {c.key && <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_DOT[c.key as keyof typeof STATUS_DOT]}`} />}
              {c.label}
              <span className="tabular-nums text-xs opacity-80" data-testid={`chip-${c.key ?? 'ALL'}-count`}>
                {c.count ?? '…'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <div>
          <label htmlFor="f-priority" className="sr-only">
            {t('tasks.filters.priority')}
          </label>
          <select
            id="f-priority"
            className="field"
            value={params.priority ?? ''}
            onChange={(e) => set({ priority: e.target.value || undefined }, { resetPage: true })}
          >
            <option value="">{t('tasks.filters.priorityAll')}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`priority.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-assignee" className="sr-only">
            {t('tasks.filters.assignee')}
          </label>
          <select
            id="f-assignee"
            className="field"
            value={params.assigneeId ?? ''}
            onChange={(e) => set({ assigneeId: e.target.value || undefined }, { resetPage: true })}
          >
            <option value="">{t('tasks.filters.assigneeAll')}</option>
            {users.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullNameAr}
              </option>
            ))}
          </select>
        </div>
        <DateFilter id="f-from" label={t('tasks.filters.dueFrom')} value={params.dueFrom} onChange={(v) => set({ dueFrom: v }, { resetPage: true })} />
        <DateFilter id="f-to" label={t('tasks.filters.dueTo')} value={params.dueTo} onChange={(v) => set({ dueTo: v }, { resetPage: true })} />
        <button type="button" onClick={resetFilters} disabled={!hasFilters} className="btn-secondary" data-testid="reset-filters-bar">
          <RotateCcw size={16} aria-hidden />
          {t('tasks.filters.reset')}
        </button>
      </div>
    </section>
  );
}

function DateFilter({ id, label, value, onChange }: { id: string; label: string; value?: string; onChange: (v?: string) => void }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="pointer-events-none absolute -top-2 start-3 bg-surface px-1 text-[11px] text-ink-muted">
        {label}
      </label>
      <input id={id} type="date" className="field" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
    </div>
  );
}
