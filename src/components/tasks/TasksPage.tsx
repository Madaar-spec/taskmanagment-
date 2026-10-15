'use client';
// /tasks — FR-15 إلى FR-27
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { t } from '@/lib/i18n';
import type { Status } from '@/lib/taskRules';
import type { TaskListItem } from '@/lib/types';
import { useStats, useTaskList } from '../hooks';
import { useSession } from '../shell/AppProviders';
import { SkeletonRows } from '../ui/Skeleton';
import { EmptyState } from './EmptyState';
import { FilterBar } from './FilterBar';
import { KpiCards } from './KpiCards';
import { Pagination } from './Pagination';
import { Sidebar } from './Sidebar';
import { TaskBoard } from './TaskBoard';
import { TaskDetailsPanel } from './TaskDetailsPanel';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskTable } from './TaskTable';
import { useStatusChange } from './useStatusChange';
import { useTaskParams } from './useTaskParams';

const BOARD_LIMIT = 200;

export function TasksPage() {
  const { user } = useSession();
  const tp = useTaskParams();
  const { params, set, apiParams, hasFilters, resetFilters } = tp;
  const [createOpen, setCreateOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const { change, dialog } = useStatusChange(user.role);

  const board = params.mode === 'board';
  const listParams = useMemo(
    () =>
      board
        ? { ...apiParams, status: undefined, pageSize: BOARD_LIMIT }
        : { ...apiParams, sort: params.sort, page: params.page, pageSize: 25 },
    [board, apiParams, params.sort, params.page],
  );
  const list = useTaskList(listParams);
  const stats = useStats(apiParams);
  // AC-03: المهمة المنشأة للتو تظهر أعلى القائمة
  const created = useTaskList({ q: justCreated ?? undefined, pageSize: 5 }, !!justCreated && !board);

  const items: TaskListItem[] = useMemo(() => {
    const base = list.data?.items ?? [];
    if (board || !justCreated) return base;
    const pinned = created.data?.items.find((i) => i.code === justCreated);
    return pinned ? [pinned, ...base.filter((i) => i.code !== justCreated)] : base;
  }, [list.data, created.data, justCreated, board]);

  const canCreate = user.role !== 'VIEWER';
  const canMove = user.role !== 'VIEWER';
  const openTask = (code: string) => set({ task: code });

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-3 sm:p-6 lg:flex-row lg:gap-6">
      <Sidebar
        view={params.view}
        stats={stats.data?.sidebar}
        onSelect={(view) => {
          setJustCreated(null);
          set({ view }, { resetPage: true });
        }}
      />
      <main id="main" className="min-w-0 flex-1 space-y-4" tabIndex={-1}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t('tasks.pageTitle')}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t('tasks.pageSubtitle')}</p>
          </div>
          {canCreate && (
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)} data-testid="new-task">
              <Plus size={18} aria-hidden />
              {t('tasks.newTask')}
            </button>
          )}
        </div>

        <KpiCards kpi={stats.data?.kpi} />
        <FilterBar tp={tp} byStatus={stats.data?.byStatus} />

        <section className="card overflow-hidden" aria-label={t(`tasks.views.${params.view}`)} aria-busy={list.isFetching}>
          {list.isLoading ? (
            <SkeletonRows />
          ) : items.length === 0 ? (
            <EmptyState
              canReset={hasFilters}
              onReset={() => {
                resetFilters();
              }}
            />
          ) : board ? (
            <>
              <TaskBoard
                items={items}
                onOpen={openTask}
                canMove={canMove}
                onMove={(task, to: Status) => change(task.code, task.status, to)}
              />
              {(list.data?.total ?? 0) > BOARD_LIMIT && (
                <p className="px-4 pb-3 text-sm text-ink-muted">{t('tasks.boardTruncated', { n: BOARD_LIMIT })}</p>
              )}
            </>
          ) : (
            <>
              <TaskTable
                items={items}
                sort={params.sort}
                onSort={(sort) => set({ sort }, { resetPage: true })}
                onOpen={openTask}
                highlight={justCreated}
              />
              <Pagination
                page={params.page}
                pageSize={25}
                total={list.data?.total ?? 0}
                onPage={(page) => set({ page })}
              />
            </>
          )}
        </section>
      </main>

      <TaskDetailsPanel code={params.task ?? null} onClose={() => set({ task: undefined })} />
      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(code) => {
          setJustCreated(code);
          if (params.page !== 1) set({ page: 1 });
        }}
      />
      {dialog}
    </div>
  );
}
