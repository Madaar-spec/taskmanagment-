'use client';
// FR-25: أربع بطاقات مؤشرات
import { AlertTriangle, CheckCircle2, ClipboardList, Timer } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { TaskStats } from '@/lib/types';
import { Skeleton } from '../ui/Skeleton';

export function KpiCards({ kpi }: { kpi: TaskStats['kpi'] | undefined }) {
  const cards = [
    { key: 'total', icon: ClipboardList, value: kpi?.total, sub: t('tasks.kpi.totalSub', { n: kpi?.new ?? 0 }), tone: 'text-st-new' },
    { key: 'active', icon: Timer, value: kpi?.active, sub: t('tasks.kpi.activeSub', { n: kpi?.review ?? 0 }), tone: 'text-st-progress' },
    { key: 'overdue', icon: AlertTriangle, value: kpi?.overdue, sub: t('tasks.kpi.overdueSub', { n: kpi?.dueSoon ?? 0 }), tone: 'text-pr-high' },
    { key: 'done', icon: CheckCircle2, value: kpi?.done, sub: t('tasks.kpi.doneSub', { n: kpi?.completionRate ?? 0 }), tone: 'text-st-done' },
  ] as const;
  return (
    <section aria-label="مؤشرات الأداء" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map(({ key, icon: Icon, value, sub, tone }) => (
        <div key={key} className="card p-4" data-testid={`kpi-${key}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-ink-muted">{t(`tasks.kpi.${key}`)}</p>
            <Icon size={18} aria-hidden className={tone} />
          </div>
          {kpi ? (
            <>
              <p className="mt-2 text-3xl font-semibold tabular-nums" data-testid={`kpi-${key}-value`}>
                {value}
              </p>
              <p className="mt-1 text-xs text-ink-muted">{sub}</p>
            </>
          ) : (
            <Skeleton className="mt-2 h-12 w-24" />
          )}
        </div>
      ))}
    </section>
  );
}
