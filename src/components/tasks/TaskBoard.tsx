'use client';
// FR-16: عرض اللوحة، FR-17: السحب بين الأعمدة مع بديل بلوحة المفاتيح (قائمة «نقل إلى»)
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import clsx from 'clsx';
import { formatDate } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { dueLabel, STATUSES, type Status } from '@/lib/taskRules';
import type { TaskListItem } from '@/lib/types';
import { useSession } from '../shell/AppProviders';
import { PriorityBadge, STATUS_DOT } from '../ui/Badges';
import { ProgressBar } from '../ui/Progress';

interface Props {
  items: TaskListItem[];
  onOpen: (code: string) => void;
  onMove: (task: TaskListItem, to: Status) => void;
  canMove: boolean;
}

export function TaskBoard({ items, onOpen, onMove, canMove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const task = items.find((i) => i.id === e.active.id);
    const to = e.over?.id as Status | undefined;
    // البطاقة تعود مكانها ما لم يقبل الخادم الانتقال (AC-13)
    if (task && to && to !== task.status) onMove(task, to);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="relative overflow-x-auto p-3">
        <div className="grid min-w-[1000px] grid-cols-4 gap-3" data-testid="task-board">
          {STATUSES.map((status) => (
            <Column key={status} status={status} items={items.filter((i) => i.status === status)} onOpen={onOpen} onMove={onMove} canMove={canMove} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function Column({ status, items, onOpen, onMove, canMove }: { status: Status; items: TaskListItem[] } & Omit<Props, 'items'>) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `col-${status}`;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-testid={`column-${status}`}
      className={clsx('flex min-h-[420px] flex-col rounded-card border bg-bg/40 p-2', isOver ? 'border-accent' : 'border-border')}
    >
      <h3 id={headingId} className="flex items-center gap-2 px-2 py-2 text-sm font-semibold">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
        {t(`status.${status}`)}
        <span className="ms-auto rounded-pill bg-surface px-2 text-xs tabular-nums text-ink-muted" data-testid={`column-${status}-count`}>
          {items.length}
        </span>
      </h3>
      <ul className="flex flex-1 flex-col gap-2">
        {items.map((task) => (
          <Card key={task.id} task={task} onOpen={onOpen} onMove={onMove} canMove={canMove} />
        ))}
      </ul>
    </section>
  );
}

function Card({ task, onOpen, onMove, canMove }: { task: TaskListItem } & Omit<Props, 'items'>) {
  const { today } = useSession();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canMove });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  // سمات السحب على مقبض البطاقة فقط حتى تبقى الأزرار والقائمة قابلة للوصول بلوحة المفاتيح
  const { role: _r, tabIndex: _ti, ...dragAttrs } = attributes;
  void _r;
  void _ti;
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`card-${task.code}`}
      className={clsx('card relative touch-manipulation p-3', isDragging && 'z-10 opacity-80 shadow-2xl ring-2 ring-accent', canMove && 'cursor-grab')}
      {...dragAttrs}
      {...listeners}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-accent" dir="ltr">
          {task.code}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
      <button type="button" onClick={() => onOpen(task.code)} className="mt-2 block w-full rounded-field text-start text-sm font-medium hover:underline">
        {task.title}
      </button>
      <p className="mt-1 text-xs text-ink-muted">{task.assignee.fullNameAr}</p>
      <p className={clsx('mt-1 text-xs', task.isOverdue ? 'text-pr-high' : 'text-ink-muted')}>
        {formatDate(task.dueDate)} · {dueLabel(task.status, task.dueDate, today)}
      </p>
      <div className="mt-2">
        <ProgressBar value={task.progress} />
      </div>
      {canMove && (
        <div className="mt-2" onPointerDown={(e) => e.stopPropagation()}>
          <label htmlFor={`move-${task.code}`} className="sr-only">
            {t('tasks.boardMoveLabel', { code: task.code })}
          </label>
          <select
            id={`move-${task.code}`}
            className="field min-h-[40px] py-1 text-xs"
            value=""
            onChange={(e) => e.target.value && onMove(task, e.target.value as Status)}
          >
            <option value="">{t('tasks.boardMoveTo')}…</option>
            {STATUSES.filter((s) => s !== task.status).map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      )}
    </li>
  );
}
