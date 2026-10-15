'use client';
// FR-15: جدول المهام، FR-21: الفرز حسب أي عمود
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { dueLabel } from '@/lib/taskRules';
import type { TaskListItem } from '@/lib/types';
import { useSession } from '../shell/AppProviders';
import { PriorityBadge, StatusBadge } from '../ui/Badges';
import { ProgressBar } from '../ui/Progress';

const COLS = [
  { key: 'code', label: 'tasks.columns.code' },
  { key: 'title', label: 'tasks.columns.title' },
  { key: 'assignee', label: 'tasks.columns.assignee' },
  { key: 'priority', label: 'tasks.columns.priority' },
  { key: 'dueDate', label: 'tasks.columns.due' },
  { key: 'progress', label: 'tasks.columns.progress' },
  { key: 'status', label: 'tasks.columns.status' },
] as const;

interface Props {
  items: TaskListItem[];
  sort?: string;
  onSort: (sort: string | undefined) => void;
  onOpen: (code: string) => void;
  highlight?: string | null;
}

export function TaskTable({ items, sort, onSort, onOpen, highlight }: Props) {
  const { today } = useSession();
  const sortKey = sort?.replace(/^-/, '');
  const desc = sort?.startsWith('-');

  function toggle(key: string) {
    // تصاعدي ← تنازلي ← الافتراضي
    if (sortKey !== key) onSort(key);
    else if (!desc) onSort(`-${key}`);
    else onSort(undefined);
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm" data-testid="task-table">
        <thead>
          <tr className="border-b border-border text-ink-muted">
            {COLS.map((c) => {
              const active = sortKey === c.key;
              const Icon = active ? (desc ? ArrowDown : ArrowUp) : ArrowUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
                  className="px-3 py-2 text-start font-medium"
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className="inline-flex min-h-touch items-center gap-1 rounded-field hover:text-ink"
                    aria-label={t('tasks.sortBy', { col: t(c.label) })}
                  >
                    {t(c.label)}
                    <Icon size={14} aria-hidden className={active ? 'text-accent' : 'opacity-50'} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((task) => (
            <tr
              key={task.id}
              data-testid={`row-${task.code}`}
              className={clsx(
                'border-b border-border/70 transition-colors hover:bg-bg/50',
                highlight === task.code && 'bg-primary/20',
              )}
            >
              <td className="whitespace-nowrap px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpen(task.code)}
                  className="min-h-touch rounded-field font-mono font-medium text-accent hover:underline"
                  dir="ltr"
                >
                  {task.code}
                </button>
              </td>
              <td className="max-w-[22rem] px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpen(task.code)}
                  className="block w-full rounded-field text-start font-medium hover:underline"
                >
                  {task.title}
                </button>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {task.department.nameAr}
                  {task.requestRef && (
                    <>
                      {' · '}
                      <span dir="ltr">{task.requestRef}</span>
                    </>
                  )}
                  {highlight === task.code && <span className="ms-2 text-accent">{t('tasks.justCreated')}</span>}
                </p>
              </td>
              <td className="whitespace-nowrap px-3 py-2">{task.assignee.fullNameAr}</td>
              <td className="px-3 py-2">
                <PriorityBadge priority={task.priority} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <p>{formatDate(task.dueDate)}</p>
                <p
                  className={clsx('text-xs', task.isOverdue ? 'text-pr-high' : task.isDueSoon ? 'text-st-progress' : 'text-ink-muted')}
                  data-testid="due-label"
                >
                  {dueLabel(task.status, task.dueDate, today)}
                </p>
              </td>
              <td className="px-3 py-2">
                <ProgressBar value={task.progress} compact />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={task.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
