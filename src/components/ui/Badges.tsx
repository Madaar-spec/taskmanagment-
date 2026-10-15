import clsx from 'clsx';
import { t } from '@/lib/i18n';
import type { PriorityLevel, Status } from '@/lib/taskRules';

// الحالة لا تُبلَّغ باللون وحده — نص الشارة دائماً (القسم 6)
const STATUS_STYLE: Record<Status, string> = {
  NEW: 'text-st-new bg-st-new/15',
  IN_PROGRESS: 'text-st-progress bg-st-progress/15',
  REVIEW: 'text-st-review bg-st-review/15',
  DONE: 'text-st-done bg-st-done/15',
};

const PRIORITY_STYLE: Record<PriorityLevel, string> = {
  HIGH: 'text-pr-high bg-pr-high/15',
  MEDIUM: 'text-pr-medium bg-pr-medium/15',
  LOW: 'text-pr-low bg-pr-low/15',
};

const base = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-medium';

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={clsx(base, STATUS_STYLE[status], className)} data-status={status}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(`status.${status}`)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  return (
    <span className={clsx(base, PRIORITY_STYLE[priority])}>
      <span className="sr-only">{t('details.priority')}: </span>
      {t(`priority.${priority}`)}
    </span>
  );
}

export const STATUS_DOT: Record<Status, string> = {
  NEW: 'bg-st-new',
  IN_PROGRESS: 'bg-st-progress',
  REVIEW: 'bg-st-review',
  DONE: 'bg-st-done',
};
