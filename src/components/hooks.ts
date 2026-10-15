'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';
import type { NotificationList, TaskDetail, TaskList, TaskStats, UserOption } from '@/lib/types';

export type ListParams = Record<string, string | number | undefined>;

export function useTaskList(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api<TaskList>(`/tasks${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useStats(params: ListParams = {}) {
  return useQuery({
    queryKey: ['stats', params],
    queryFn: () => api<TaskStats>(`/tasks/stats${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** الجرس: عدّاد المتأخرة ضمن النطاق، يُحدَّث في الخلفية دون تجديد الجلسة */
export function useBell() {
  return useQuery({
    queryKey: ['stats', {}],
    queryFn: () => api<TaskStats>('/tasks/stats', { background: true }),
    refetchInterval: 60_000,
  });
}

export function useTask(code: string | null) {
  return useQuery({
    queryKey: ['task', code],
    queryFn: () => api<TaskDetail>(`/tasks/${encodeURIComponent(code!)}`),
    enabled: !!code,
    retry: false,
  });
}

export function useUsers(purpose: 'assign' | 'filter') {
  return useQuery({
    queryKey: ['users', purpose],
    queryFn: () => api<UserOption[]>(`/users${qs({ active: purpose === 'assign' ? 'true' : undefined, purpose })}`),
    staleTime: 5 * 60_000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationList>('/notifications', { background: true }),
    refetchInterval: 60_000,
  });
}

/** تحديث كل ما يتأثر بتغيير مهمة: التفاصيل والقائمة واللوحة والمؤشرات (AC-05) */
export function useInvalidateTasks() {
  const qc = useQueryClient();
  return (code?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['tasks'] }),
      qc.invalidateQueries({ queryKey: ['stats'] }),
      qc.invalidateQueries({ queryKey: ['notifications'] }),
      code ? qc.invalidateQueries({ queryKey: ['task', code] }) : Promise.resolve(),
    ]);
}

export { useMutation };
