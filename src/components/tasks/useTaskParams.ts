'use client';
// FR-24: حفظ طريقة العرض والتصفية في رابط الصفحة
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export const FILTER_KEYS = ['status', 'priority', 'assigneeId', 'dueFrom', 'dueTo', 'q'] as const;
type Key = 'mode' | 'view' | 'sort' | 'page' | 'task' | (typeof FILTER_KEYS)[number];

export function useTaskParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params = useMemo(() => {
    const get = (k: Key) => sp.get(k) ?? undefined;
    return {
      mode: (get('mode') === 'board' ? 'board' : 'list') as 'list' | 'board',
      view: get('view') ?? 'all',
      status: get('status'),
      priority: get('priority'),
      assigneeId: get('assigneeId'),
      dueFrom: get('dueFrom'),
      dueTo: get('dueTo'),
      q: get('q'),
      sort: get('sort'),
      page: Math.max(1, Number(get('page') ?? 1) || 1),
      task: get('task'),
    };
  }, [sp]);

  const set = useCallback(
    (patch: Partial<Record<Key, string | number | undefined | null>>, opts: { resetPage?: boolean } = {}) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '' || (k === 'view' && v === 'all') || (k === 'mode' && v === 'list') || (k === 'page' && Number(v) === 1)) {
          next.delete(k);
        } else next.set(k, String(v));
      }
      if (opts.resetPage) next.delete('page');
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  const hasFilters = FILTER_KEYS.some((k) => params[k]);
  const resetFilters = useCallback(
    () => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])), { resetPage: true }),
    [set],
  );

  /** معاملات API للقائمة والمؤشرات */
  const apiParams = useMemo(
    () => ({
      view: params.view,
      status: params.status,
      priority: params.priority,
      assigneeId: params.assigneeId,
      dueFrom: params.dueFrom,
      dueTo: params.dueTo,
      q: params.q,
    }),
    [params],
  );

  return { params, set, hasFilters, resetFilters, apiParams };
}
