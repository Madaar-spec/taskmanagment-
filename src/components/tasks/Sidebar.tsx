'use client';
// FR-20: القوائم الجاهزة مع العدّادات + معدل الإنجاز
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, LayoutList, UserRound } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { TaskStats } from '@/lib/types';
import { Skeleton } from '../ui/Skeleton';

const VIEWS = [
  { key: 'all', icon: LayoutList },
  { key: 'mine', icon: UserRound },
  { key: 'overdue', icon: AlertTriangle },
  { key: 'done', icon: CheckCircle2 },
] as const;

export function Sidebar({
  view,
  stats,
  onSelect,
}: {
  view: string;
  stats: TaskStats['sidebar'] | undefined;
  onSelect: (view: string) => void;
}) {
  return (
    <aside className="card w-full shrink-0 p-3 lg:sticky lg:top-20 lg:w-64 lg:self-start">
      <nav aria-label={t('tasks.views.label')}>
        <p className="section-title px-2 pb-2">{t('tasks.views.label')}</p>
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
          {VIEWS.map(({ key, icon: Icon }) => {
            const active = view === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-current={active ? 'page' : undefined}
                  data-testid={`view-${key}`}
                  className={clsx(
                    'flex min-h-touch w-full items-center gap-2 rounded-field px-3 text-sm transition-colors',
                    active ? 'bg-primary font-medium text-ink' : 'text-ink-muted hover:bg-bg hover:text-ink',
                  )}
                >
                  <Icon size={17} aria-hidden />
                  <span className="flex-1 truncate text-start">{t(`tasks.views.${key}`)}</span>
                  <span className="rounded-pill bg-bg/60 px-2 text-xs tabular-nums" data-testid={`view-${key}-count`}>
                    {stats ? stats[key] : '…'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-4 rounded-field border border-border bg-bg/40 p-3">
        <p className="text-xs text-ink-muted">{t('tasks.completionRate')}</p>
        {stats ? (
          <>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.completionRate}%</p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label={t('tasks.completionRate')}
              aria-valuenow={stats.completionRate}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-accent" style={{ width: `${stats.completionRate}%` }} />
            </div>
          </>
        ) : (
          <Skeleton className="mt-2 h-10 w-full" />
        )}
      </div>
    </aside>
  );
}
