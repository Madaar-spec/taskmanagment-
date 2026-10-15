import { t } from '@/lib/i18n';

export function ProgressBar({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2" data-testid="progress">
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('tasks.progressLabel', { n: value })}
        className={`${compact ? 'h-1.5 w-20' : 'h-2 w-full'} overflow-hidden rounded-full bg-border`}
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${value}%` }} />
      </div>
      <span className="min-w-[3ch] text-xs tabular-nums text-ink-muted" data-testid="progress-value">
        {value}%
      </span>
    </div>
  );
}
